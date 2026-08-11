import {
  Position, Player, PlayerRole, TeamSide, TerrainType, Weather,
  GameState, BOARD_HEIGHT,
} from '../types';
import { SPELLS } from '../constants';
import {
  Rng,
  manhattanDistance,
  isAdjacent,
  isPositionValid,
  isHazard,
  reachableTiles,
  findPath,
  validateSpellCast,
  weatherPassModifier,
} from './rules';

// A pure, rng-injected, rules-based opponent brain. It is deliberately NOT an
// AI-model client: nothing here talks to a language model, a network, or a
// vendor SDK. It reads a snapshot of the game and emits an ordered list of
// plain-data actions for one side to take this turn, which the App layer then
// executes one at a time through the existing move/tackle/pass/spell handlers.
//
// Design constraints (see the item spec):
//  - Deterministic given the same state + seeded rng (rng is only used to break
//    ties between equally-good choices, so play stays varied but reproducible).
//  - Every emitted action is legal against the *planned* state at the point it
//    runs: the planner keeps a lightweight working copy of the board and folds
//    each action's deterministic effect (a step, a pickup, an action being
//    spent) into it before deciding the next one.
//  - The turn always terminates: each player is considered at most once, and a
//    hard action cap (`MAX_OPPONENT_ACTIONS`) guards the whole plan. The list
//    always ends with a `pass-turn`, so even an empty or fully-stunned side
//    produces a legal, terminating turn.

/** One plain-data instruction for the App layer to execute. */
export type OpponentAction =
  | { type: 'move'; playerId: string; to: Position; path: Position[]; reason: string }
  | { type: 'tackle'; playerId: string; targetId: string; reason: string }
  | { type: 'pass'; playerId: string; to: Position; targetId: string; reason: string }
  | { type: 'spell'; playerId: string; spell: keyof typeof SPELLS; target: Position; targetId: string | null; reason: string }
  | { type: 'pass-turn'; reason: string };

/**
 * Absolute ceiling on the number of actions a single turn plan may contain
 * (the terminating `pass-turn` included). The per-player loop already bounds
 * the plan to ~2 actions per unit; this is a belt-and-braces guard so a plan
 * can never run away regardless of squad size or future heuristics.
 */
export const MAX_OPPONENT_ACTIONS = 64;

/**
 * A pass is only worth attempting when the thrower can plausibly complete it.
 * `resolvePass` needs `skill + d6 >= 2 + distance + weatherMod`; we require the
 * shortfall to be beatable on a roll of 4 or better (roughly even odds), i.e.
 * `difficulty - skill <= PASS_ROLL_MARGIN`.
 */
export const PASS_ROLL_MARGIN = 4;

// --- Working state ---------------------------------------------------------
//
// A minimal, mutable mirror of the players and the ball, cloned from the
// snapshot so planning never touches the real GameState. Only the fields the
// heuristics read or update are carried.

interface WorkPlayer {
  id: string;
  role: PlayerRole;
  team: TeamSide;
  position: Position;
  strength: number;
  skill: number;
  hasBall: boolean;
  isStunned: boolean;
  mana: number;
  movesRemaining: number;
  actionTaken: boolean;
}

interface WorkBall {
  /** The loose ball's tile, or null when a player is carrying it. */
  pos: Position | null;
  /** The id of the carrier, or null when the ball is loose. */
  carrierId: string | null;
}

const cloneWorkPlayer = (p: Player): WorkPlayer => ({
  id: p.id,
  role: p.role,
  team: p.team,
  position: { x: p.position.x, y: p.position.y },
  strength: p.stats.strength,
  skill: p.stats.skill,
  hasBall: p.hasBall,
  isStunned: p.isStunned,
  mana: p.mana,
  movesRemaining: p.movesRemaining,
  actionTaken: p.actionTaken,
});

/** The endzone row a side is attacking (where carrying the ball scores). */
export const attackingEndzoneY = (side: TeamSide): number =>
  side === TeamSide.HOME ? BOARD_HEIGHT - 1 : 0;

/**
 * How far a tile is *toward* the given side's scoring endzone, as a simple
 * "higher is better" score. HOME drives down the board (increasing y), AWAY
 * drives up it (decreasing y), so both are normalised to the same sense.
 */
export const forwardProgress = (side: TeamSide, pos: Position): number =>
  side === TeamSide.HOME ? pos.y : BOARD_HEIGHT - 1 - pos.y;

// --- Planner ---------------------------------------------------------------

/**
 * Plan one full turn for `side` (defaulting to whoever is to move). Returns an
 * ordered list of legal, plain-data actions ending in `pass-turn`. Pure and
 * deterministic given the same `state` and seeded `rng`; the rng only decides
 * between equally-ranked choices.
 */
export const planOpponentTurn = (
  state: GameState,
  rng: Rng,
  side: TeamSide = state.currentTeam
): OpponentAction[] => {
  const actions: OpponentAction[] = [];
  const work: WorkPlayer[] = [
    ...state.homeTeam.players,
    ...state.awayTeam.players,
  ].map(cloneWorkPlayer);

  const ball: WorkBall = {
    pos: state.ballPosition ? { ...state.ballPosition } : null,
    carrierId: work.find((w) => w.hasBall)?.id ?? null,
  };

  const enemySide = side === TeamSide.HOME ? TeamSide.AWAY : TeamSide.HOME;
  const weatherMod = weatherPassModifier(state.weather);

  // --- board queries (read the working copy) --------------------------------

  const occupiedBy = (pos: Position, ignoreId?: string): WorkPlayer | undefined =>
    work.find(
      (w) => w.id !== ignoreId && w.position.x === pos.x && w.position.y === pos.y
    );

  /** Tiles a mover must never step on: any occupied square. The loose ball's
   *  tile has no player on it, so it stays walkable (and picks the ball up). */
  const blockedFor = (moverId: string) => (pos: Position): boolean =>
    occupiedBy(pos, moverId) !== undefined;

  /** A tile a move should avoid landing on when any safe alternative exists:
   *  a live lava hazard, or the tile a telegraphed meteor is about to strike. */
  const shouldAvoid = (pos: Position): boolean => {
    if (state.terrain === TerrainType.LAVA && isHazard(pos, state.hazards)) return true;
    if (state.meteor && state.meteor.target.x === pos.x && state.meteor.target.y === pos.y) return true;
    return false;
  };

  /**
   * Pick the tile that maximises `score`, preferring tiles that are not hazard
   * / meteor tiles but falling back to them rather than refusing to move. Ties
   * are broken deterministically, then one of the equals is chosen via the rng
   * so equally-good play still varies with the seed.
   */
  const chooseTile = (
    candidates: Position[],
    score: (p: Position) => number
  ): Position | null => {
    if (candidates.length === 0) return null;
    const safe = candidates.filter((c) => !shouldAvoid(c));
    const pool = safe.length > 0 ? safe : candidates;
    let best: Position[] = [];
    let bestScore = -Infinity;
    for (const c of pool) {
      const s = score(c);
      if (s > bestScore + 1e-9) {
        bestScore = s;
        best = [c];
      } else if (Math.abs(s - bestScore) <= 1e-9) {
        best.push(c);
      }
    }
    best.sort((a, b) => a.y - b.y || a.x - b.x);
    return best[Math.floor(rng() * best.length)];
  };

  // --- applying an action's deterministic effect to the working copy --------

  const moveTo = (p: WorkPlayer, to: Position): OpponentAction | null => {
    const path = findPath(p.position, to, p.movesRemaining, blockedFor(p.id));
    if (!path || path.length === 0) return null;
    p.position = { x: to.x, y: to.y };
    p.movesRemaining -= path.length;
    let reason = 'repositions';
    // Auto-pickup: stepping onto the loose ball claims it (no roll, matching the
    // move handler). Optimistically fold that into the plan so later units know
    // the ball is no longer loose.
    if (ball.pos && ball.pos.x === to.x && ball.pos.y === to.y) {
      p.hasBall = true;
      ball.pos = null;
      ball.carrierId = p.id;
      reason = 'chases down the loose ball';
    } else if (p.hasBall) {
      reason = 'drives the ball forward';
    }
    return { type: 'move', playerId: p.id, to: { x: to.x, y: to.y }, path, reason };
  };

  // --- per-unit heuristics --------------------------------------------------

  const enemies = () => work.filter((w) => w.team === enemySide && !w.isStunned);
  const allies = () => work.filter((w) => w.team === side);

  /** The un-stunned team-mate best placed to receive a forward pass, if any. */
  const bestPassReceiver = (carrier: WorkPlayer): WorkPlayer | null => {
    const here = forwardProgress(side, carrier.position);
    const options = allies().filter((a) => {
      if (a.id === carrier.id || a.isStunned) return false;
      if (forwardProgress(side, a.position) <= here) return false; // must be ahead
      const dist = manhattanDistance(carrier.position, a.position);
      const difficulty = 2 + dist + weatherMod;
      return difficulty - carrier.skill <= PASS_ROLL_MARGIN;
    });
    if (options.length === 0) return null;
    options.sort(
      (a, b) =>
        forwardProgress(side, b.position) - forwardProgress(side, a.position) ||
        manhattanDistance(carrier.position, a.position) -
          manhattanDistance(carrier.position, b.position) ||
        a.id.localeCompare(b.id)
    );
    return options[0];
  };

  /** Try to spend a Wizard's mana well; returns the spell action or null. */
  const planWizardSpell = (w: WorkPlayer): OpponentAction | null => {
    // Fireball the enemy ball-carrier (or nearest enemy) inside range.
    if (w.mana >= SPELLS.FIREBALL.cost) {
      const targets = enemies()
        .filter((e) => manhattanDistance(w.position, e.position) <= SPELLS.FIREBALL.range)
        .sort(
          (a, b) =>
            Number(b.id === ball.carrierId) - Number(a.id === ball.carrierId) ||
            manhattanDistance(w.position, a.position) -
              manhattanDistance(w.position, b.position) ||
            a.id.localeCompare(b.id)
        );
      const target = targets[0];
      if (target) {
        const dummy = { position: w.position } as Player;
        const v = validateSpellCast('FIREBALL', dummy, target.position, { team: target.team } as Player, SPELLS.FIREBALL.range);
        if (v.valid) {
          w.mana -= SPELLS.FIREBALL.cost;
          w.actionTaken = true;
          w.movesRemaining = 0;
          return {
            type: 'spell', playerId: w.id, spell: 'FIREBALL',
            target: { ...target.position }, targetId: target.id,
            reason: 'hurls a fireball',
          };
        }
      }
    }
    // Revitalize an adjacent stunned ally.
    if (w.mana >= SPELLS.HEAL.cost) {
      const ally = allies().find(
        (a) => a.id !== w.id && a.isStunned && manhattanDistance(w.position, a.position) <= SPELLS.HEAL.range
      );
      if (ally) {
        w.mana -= SPELLS.HEAL.cost;
        w.actionTaken = true;
        w.movesRemaining = 0;
        return {
          type: 'spell', playerId: w.id, spell: 'HEAL',
          target: { ...ally.position }, targetId: ally.id,
          reason: 'revitalises a fallen ally',
        };
      }
    }
    return null;
  };

  /**
   * Plan the carrier's action: run the ball at the endzone, and only pass or
   * (as a Wizard) blink when genuinely boxed in with no forward step.
   */
  const planCarrier = (p: WorkPlayer): OpponentAction[] => {
    const out: OpponentAction[] = [];
    const here = forwardProgress(side, p.position);
    const tiles = p.movesRemaining > 0
      ? reachableTiles(p.position, p.movesRemaining, blockedFor(p.id))
      : [];
    const bestTile = chooseTile(tiles, (t) => forwardProgress(side, t));
    const canAdvance = bestTile !== null && forwardProgress(side, bestTile) > here;

    if (canAdvance) {
      const mv = moveTo(p, bestTile!);
      if (mv) out.push(mv);
      return out;
    }

    // Boxed in: look for a forward pass to a better-placed team-mate.
    const receiver = bestPassReceiver(p);
    if (receiver) {
      p.hasBall = false;
      p.actionTaken = true;
      p.movesRemaining = 0;
      ball.carrierId = receiver.id; // optimistic: assume the pass connects
      ball.pos = null;
      out.push({
        type: 'pass', playerId: p.id, to: { ...receiver.position }, targetId: receiver.id,
        reason: 'throws downfield past the block',
      });
      return out;
    }

    // A Wizard with the ball can blink past the wall toward the endzone.
    if (p.role === PlayerRole.WIZARD && p.mana >= SPELLS.TELEPORT.cost) {
      const landing = chooseTile(
        candidateBlinkTiles(p, SPELLS.TELEPORT.range),
        (t) => forwardProgress(side, t)
      );
      if (landing && forwardProgress(side, landing) > here) {
        const dummy = { position: p.position } as Player;
        const v = validateSpellCast('TELEPORT', dummy, landing, occupiedBy(landing) as unknown as Player | undefined, SPELLS.TELEPORT.range);
        if (v.valid) {
          p.mana -= SPELLS.TELEPORT.cost;
          p.actionTaken = true;
          p.position = { ...landing };
          out.push({
            type: 'spell', playerId: p.id, spell: 'TELEPORT',
            target: { ...landing }, targetId: null,
            reason: 'blinks through the wall',
          });
          return out;
        }
      }
    }

    // Nothing better than a lateral shuffle: still move if a tile is open so the
    // carrier is never simply stuck, otherwise hold position.
    if (bestTile) {
      const mv = moveTo(p, bestTile);
      if (mv) out.push(mv);
    }
    return out;
  };

  /** Empty on-board tiles within Blink range of the caster. */
  const candidateBlinkTiles = (p: WorkPlayer, range: number): Position[] => {
    const tiles: Position[] = [];
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        if (Math.abs(dx) + Math.abs(dy) > range || (dx === 0 && dy === 0)) continue;
        const t = { x: p.position.x + dx, y: p.position.y + dy };
        if (!isPositionValid(t) || occupiedBy(t)) continue;
        tiles.push(t);
      }
    }
    return tiles;
  };

  /** Chase and pick up the loose ball. */
  const planChaseBall = (p: WorkPlayer): OpponentAction[] => {
    if (!ball.pos || p.movesRemaining <= 0) return [];
    const tiles = reachableTiles(p.position, p.movesRemaining, blockedFor(p.id));
    // Prefer landing exactly on the ball (a pickup); otherwise get as close as
    // possible for next turn.
    const onBall = tiles.find((t) => t.x === ball.pos!.x && t.y === ball.pos!.y);
    const target = onBall ?? chooseTile(tiles, (t) => -manhattanDistance(t, ball.pos!));
    if (!target) return [];
    const mv = moveTo(p, target);
    return mv ? [mv] : [];
  };

  /**
   * Support / defence: close on the best enemy (the ball carrier for
   * preference) and lay in a favourable tackle. A tackle is only thrown when
   * the odds favour us (`strength >= target`), except that the enemy carrier is
   * always worth hitting to jar the ball loose.
   */
  const planSupport = (p: WorkPlayer): OpponentAction[] => {
    const out: OpponentAction[] = [];
    const foes = enemies();
    if (foes.length === 0) return out;

    const carrier = foes.find((e) => e.id === ball.carrierId) ?? null;
    const rank = (e: WorkPlayer): number =>
      Number(e.id === ball.carrierId) * 100 - manhattanDistance(p.position, e.position);
    foes.sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id));
    const target = foes[0];

    const worthTackling = (e: WorkPlayer): boolean =>
      p.strength >= e.strength || e.id === ball.carrierId;

    const tackle = (e: WorkPlayer): OpponentAction => {
      p.actionTaken = true;
      p.movesRemaining = 0;
      return {
        type: 'tackle', playerId: p.id, targetId: e.id,
        reason: e.id === ball.carrierId ? 'hits the ball carrier' : 'throws a block',
      };
    };

    // Already in range of a worthwhile hit (and a move point spare to make it).
    if (isAdjacent(p.position, target.position) && p.movesRemaining > 0 && worthTackling(target)) {
      out.push(tackle(target));
      return out;
    }

    // Otherwise close the distance. A tackle costs a Move point, so first look
    // for a tile adjacent to the goal reachable with a step to SPARE (that is,
    // within movesRemaining - 1); only when no such tile exists fall back to
    // plain closing, which may spend everything and forfeit the hit.
    if (p.movesRemaining > 0) {
      const goal = carrier ?? target;
      const striking = p.movesRemaining > 1
        ? reachableTiles(p.position, p.movesRemaining - 1, blockedFor(p.id))
            .filter((t) => isAdjacent(t, goal.position))
        : [];
      const step = striking.length > 0
        ? chooseTile(striking, (t) => -manhattanDistance(t, goal.position))
        : chooseTile(
            reachableTiles(p.position, p.movesRemaining, blockedFor(p.id)),
            (t) => -manhattanDistance(t, goal.position)
          );
      if (step) {
        const mv = moveTo(p, step);
        if (mv) out.push(mv);
      }
    }
    if (
      p.movesRemaining > 0 &&
      !p.actionTaken &&
      isAdjacent(p.position, target.position) &&
      worthTackling(target)
    ) {
      out.push(tackle(target));
    }
    return out;
  };

  // --- turn assembly --------------------------------------------------------
  //
  // Order of play: the ball carrier first, then (if the ball is loose) the
  // single closest chaser, then everyone else. Fixing the order keeps the plan
  // deterministic and stops the whole squad piling onto the same ball.

  const mine = allies().filter((p) => !p.isStunned && !p.actionTaken);

  let chaserId: string | null = null;
  if (ball.pos) {
    // The chaser is the unit that can actually REACH the ball this turn (the
    // shortest such path wins), not merely the closest as the crow flies: a
    // fast Catcher nine tiles out beats a slow Quarterback seven tiles out.
    const candidates = mine.filter((p) => p.movesRemaining > 0);
    const pathLen = (p: WorkPlayer): number => {
      const path = findPath(p.position, ball.pos!, p.movesRemaining, blockedFor(p.id));
      return path ? path.length : Infinity;
    };
    const reachers = candidates
      .map((p) => ({ p, len: pathLen(p) }))
      .filter((c) => c.len !== Infinity)
      .sort((a, b) => a.len - b.len || a.p.id.localeCompare(b.p.id));
    if (reachers.length > 0) {
      chaserId = reachers[0].p.id;
    } else {
      // Nobody reaches it this turn: send whoever is closest to shorten the
      // chase next turn.
      const chasers = candidates.sort(
        (a, b) =>
          manhattanDistance(a.position, ball.pos!) - manhattanDistance(b.position, ball.pos!) ||
          a.id.localeCompare(b.id)
      );
      chaserId = chasers[0]?.id ?? null;
    }
  }

  const orderKey = (p: WorkPlayer): number => {
    if (p.id === ball.carrierId) return 0;
    if (p.id === chaserId) return 1;
    return 2;
  };
  const ordered = mine.slice().sort((a, b) => orderKey(a) - orderKey(b) || a.id.localeCompare(b.id));

  for (const p of ordered) {
    if (actions.length >= MAX_OPPONENT_ACTIONS - 1) break; // leave room for pass-turn

    let planned: OpponentAction[] = [];

    if (p.role === PlayerRole.WIZARD && p.id !== ball.carrierId) {
      const spell = planWizardSpell(p);
      if (spell) planned = [spell];
    }

    if (planned.length === 0) {
      if (p.id === ball.carrierId) planned = planCarrier(p);
      else if (ball.pos && p.id === chaserId) planned = planChaseBall(p);
      else planned = planSupport(p);
    }

    for (const a of planned) {
      if (actions.length >= MAX_OPPONENT_ACTIONS - 1) break;
      actions.push(a);
    }
  }

  actions.push({ type: 'pass-turn', reason: 'ends the turn' });
  return actions;
};
