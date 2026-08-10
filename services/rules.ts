import {
  Position, Player, TeamSide, TerrainType, Weather, MeteorWarning,
  BOARD_WIDTH, BOARD_HEIGHT,
} from '../types';

// Pure, deterministic game-rules logic extracted from App.tsx and gameUtils.ts.
//
// Nothing in this module reads a global clock or a global RNG: every function
// that needs randomness takes an `Rng` argument. That makes the rules unit
// testable with a seeded/fake source and keeps the "roll" separate from the
// "resolve". `gameUtils.ts` binds these to the real runtime rng.

/** A source of randomness returning a float in [0, 1), as the runtime rng does. */
export type Rng = () => number;

/** Roll a single die with `sides` faces using the injected rng. */
export const rollDie = (rng: Rng, sides: number = 6): number =>
  Math.floor(rng() * sides) + 1;

/** True when `pos` lies on the board. */
export const isPositionValid = (pos: Position): boolean =>
  pos.x >= 0 && pos.x < BOARD_WIDTH && pos.y >= 0 && pos.y < BOARD_HEIGHT;

/** Manhattan (grid) distance between two positions. */
export const manhattanDistance = (a: Position, b: Position): number =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Adjacency including diagonals (a king's move), excluding the tile itself. */
export const isAdjacent = (a: Position, b: Position): boolean => {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx <= 1 && dy <= 1 && dx + dy > 0;
};

/** The player occupying `pos`, if any. */
export const getPlayerAtPosition = (
  pos: Position,
  players: Player[]
): Player | undefined =>
  players.find((p) => p.position.x === pos.x && p.position.y === pos.y);

export interface TackleResult {
  success: boolean;
  attackRoll: number;
  defendRoll: number;
  log: string;
}

/** STR + d6 vs STR + d6; attacker wins on a strictly higher total. */
export const resolveTackle = (
  attacker: Player,
  defender: Player,
  rng: Rng
): TackleResult => {
  const attackRoll = rollDie(rng, 6) + attacker.stats.strength;
  const defendRoll = rollDie(rng, 6) + defender.stats.strength;
  const success = attackRoll > defendRoll;
  return {
    success,
    attackRoll,
    defendRoll,
    log: success
      ? `${attacker.name} smashed ${defender.name} (Roll: ${attackRoll} vs ${defendRoll})!`
      : `${attacker.name} bounced off ${defender.name} (Roll: ${attackRoll} vs ${defendRoll})!`,
  };
};

export interface PassResult {
  success: boolean;
  roll: number;
  difficulty: number;
  log: string;
}

/**
 * SKL + d6 vs `2 + manhattan_distance + weatherMod`; success on roll >= difficulty.
 * The difficulty metric is Manhattan (grid) distance to match the rulebook
 * (`GAME_RULES` in utils/contextSerializer.ts) and CLAUDE.md. Bad weather
 * (`weatherMod`, from `weatherPassModifier`) raises the difficulty on top of it.
 */
export const resolvePass = (
  thrower: Player,
  targetPos: Position,
  rng: Rng,
  weatherMod: number = 0
): PassResult => {
  const difficulty = 2 + manhattanDistance(thrower.position, targetPos) + weatherMod;
  const roll = rollDie(rng, 6) + thrower.stats.skill;
  const success = roll >= difficulty;
  return {
    success,
    roll,
    difficulty,
    log: success
      ? `${thrower.name} throws a perfect spiral! (Roll: ${roll} vs DC: ${difficulty})`
      : `${thrower.name} fumbles the pass! (Roll: ${roll} vs DC: ${difficulty})`,
  };
};

/**
 * Scatter a loose ball one square diagonally from `pos`, clamped inside the
 * playable field (excluding the outer border rows/columns). Consumes two rng
 * draws (x then y).
 */
export const scatterPosition = (pos: Position, rng: Rng): Position => {
  const scatterX = pos.x + (rng() > 0.5 ? 1 : -1);
  const scatterY = pos.y + (rng() > 0.5 ? 1 : -1);
  return {
    x: Math.max(1, Math.min(BOARD_WIDTH - 2, scatterX)),
    y: Math.max(1, Math.min(BOARD_HEIGHT - 2, scatterY)),
  };
};

// --- Win condition ---------------------------------------------------------
//
// The game ends when either team reaches `WIN_SCORE` points (3 touchdowns at
// 7 points each), or once `MAX_TURNS` full turns have elapsed, whichever comes
// first. The winner is the higher score at that point; an equal score is a draw
// (isGameOver true, winner null). Kept pure so App can wire it into both the
// touchdown path and end-of-turn without duplicating the thresholds.

export const WIN_SCORE = 21;
export const MAX_TURNS = 16;

export interface GameOutcome {
  isGameOver: boolean;
  winner: TeamSide | null;
}

export const checkWinner = (
  homeScore: number,
  awayScore: number,
  turn: number,
  winScore: number = WIN_SCORE,
  maxTurns: number = MAX_TURNS
): GameOutcome => {
  const reachedCap = homeScore >= winScore || awayScore >= winScore;
  const outOfTurns = turn > maxTurns;
  if (!reachedCap && !outOfTurns) {
    return { isGameOver: false, winner: null };
  }
  let winner: TeamSide | null = null;
  if (homeScore > awayScore) winner = TeamSide.HOME;
  else if (awayScore > homeScore) winner = TeamSide.AWAY;
  return { isGameOver: true, winner };
};

// --- Spell targeting -------------------------------------------------------
//
// Enforces range and target validity for the three spells so the code matches
// what SPELLS advertises and what the LLM tells players. Range is measured as
// Manhattan distance from the caster's tile.
//
// - Fireball (range 4): must strike an enemy player. Cannot hit an ally or an
//   empty tile.
// - Blink    (range 5): must land on an empty, on-board tile. Cannot land on an
//   occupied square.
// - Revitalize (range 1): must target a stunned ally. Cannot clear an enemy's
//   stun or "heal" someone who is not stunned.

export interface SpellValidation {
  valid: boolean;
  reason: string;
}

export const validateSpellCast = (
  spellKey: string,
  caster: Player,
  targetPos: Position,
  targetPlayer: Player | undefined,
  range: number
): SpellValidation => {
  const dist = manhattanDistance(caster.position, targetPos);
  if (dist > range) {
    return { valid: false, reason: `Target out of range (${dist} > ${range}).` };
  }

  switch (spellKey) {
    case 'FIREBALL': // Fireball
      if (!targetPlayer) return { valid: false, reason: 'Fireball needs an enemy target.' };
      if (targetPlayer.team === caster.team) return { valid: false, reason: 'Fireball cannot target an ally.' };
      return { valid: true, reason: '' };
    case 'TELEPORT': // Blink
      if (!isPositionValid(targetPos)) return { valid: false, reason: 'Blink target is off the board.' };
      if (targetPlayer) return { valid: false, reason: 'Blink must target an empty square.' };
      return { valid: true, reason: '' };
    case 'HEAL': // Revitalize
      if (!targetPlayer) return { valid: false, reason: 'Revitalize needs an ally target.' };
      if (targetPlayer.team !== caster.team) return { valid: false, reason: 'Revitalize can only aid allies.' };
      if (!targetPlayer.isStunned) return { valid: false, reason: 'That ally is not stunned.' };
      return { valid: true, reason: '' };
    default:
      return { valid: true, reason: '' };
  }
};

// --- Terrain & weather -----------------------------------------------------
//
// Terrain and weather turn the four cosmetic pitch/sky types into real
// mechanics. Everything here is pure and rng-injected so it stays testable:
//
// - Mud   (Orc Pits):    a completed step has a chance to slip, dropping the
//                        mover prone (stunned) where they land.
// - Lava  (Demon Forge): a fixed set of seeded hazard tiles knock down anyone
//                        who steps onto them.
// - Ice   (Frozen Wastes): a step slides one extra tile in the travel direction
//                        when that tile is open.
// - Rain / Blizzard:     raise pass difficulty (`weatherPassModifier`).
//                        Blizzard also costs every player 1 Move point per turn
//                        (`weatherMovePenalty` / `effectiveMove`).
// - Meteor Shower:       a meteor is telegraphed one round, then strikes its
//                        tile, knocking down whoever stands there.

/** Probability that a single step on Mud terrain ends in a slip (knockdown). */
export const MUD_SLIP_CHANCE = 0.25;

/** Number of seeded hazard tiles placed on a Lava pitch. */
export const LAVA_HAZARD_COUNT = 6;

/** Extra pass difficulty from the current weather (Rain +1, Blizzard +2). */
export const weatherPassModifier = (weather: Weather): number => {
  switch (weather) {
    case Weather.RAIN:
      return 1;
    case Weather.BLIZZARD:
      return 2;
    default:
      return 0;
  }
};

/**
 * Move-point penalty every player suffers from the current weather. Only a
 * Blizzard bites here: driving snow costs every player 1 Move point per turn,
 * on top of the +2 pass difficulty from `weatherPassModifier`. Returned as a
 * positive magnitude to subtract from a unit's base Move.
 */
export const weatherMovePenalty = (weather: Weather): number =>
  weather === Weather.BLIZZARD ? 1 : 0;

/**
 * A player's effective Move for the turn given the weather. The Blizzard
 * penalty never drops a unit below 1, so a snowed-in player can still shuffle a
 * single square.
 */
export const effectiveMove = (baseMove: number, weather: Weather): number =>
  Math.max(1, baseMove - weatherMovePenalty(weather));

/** True when `pos` is one of the seeded lava hazard tiles. */
export const isHazard = (pos: Position, hazards: Position[]): boolean =>
  hazards.some((h) => h.x === pos.x && h.y === pos.y);

/**
 * Pick `count` distinct interior tiles (off the endzone rows) as lava hazards,
 * deterministically from the injected rng. A bounded guard stops the loop even
 * if the rng keeps colliding.
 */
export const generateLavaHazards = (count: number, rng: Rng): Position[] => {
  const hazards: Position[] = [];
  let guard = 0;
  while (hazards.length < count && guard < count * 40) {
    guard++;
    const x = 1 + Math.floor(rng() * (BOARD_WIDTH - 2));
    const y = 2 + Math.floor(rng() * (BOARD_HEIGHT - 4));
    if (!hazards.some((p) => p.x === x && p.y === y)) hazards.push({ x, y });
  }
  return hazards;
};

export interface StepEffect {
  /** Where the mover ends up (ice can carry them one tile further). */
  position: Position;
  /** True when the mover is knocked down (stunned) on arrival. */
  knockedDown: boolean;
  /** A player-facing line describing what happened, or null for a plain step. */
  log: string | null;
}

/**
 * Resolve the terrain side-effect of a single completed step from `from` to
 * `to`. Grass is a no-op. Only Mud consumes the rng (its slip roll); ice slide
 * and lava hazards are deterministic given their inputs. `isBlocked` reports
 * whether a prospective slide tile is occupied, so ice never slides onto a unit.
 */
export const resolveTerrainStep = (
  terrain: TerrainType,
  from: Position,
  to: Position,
  hazards: Position[],
  isBlocked: (pos: Position) => boolean,
  rng: Rng
): StepEffect => {
  if (terrain === TerrainType.LAVA && isHazard(to, hazards)) {
    return {
      position: to,
      knockedDown: true,
      log: `The molten ground erupts at (${to.x}, ${to.y}) - knocked down on a lava hazard!`,
    };
  }

  if (terrain === TerrainType.MUD && rng() < MUD_SLIP_CHANCE) {
    return { position: to, knockedDown: true, log: 'Lost their footing in the mud and slipped!' };
  }

  if (terrain === TerrainType.ICE) {
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    const slide = { x: to.x + dx, y: to.y + dy };
    if ((dx !== 0 || dy !== 0) && isPositionValid(slide) && !isBlocked(slide)) {
      return { position: slide, knockedDown: false, log: `Slid across the ice to (${slide.x}, ${slide.y}).` };
    }
  }

  return { position: to, knockedDown: false, log: null };
};

export interface MeteorResolution {
  /** The tile struck by the meteor telegraphed last round, or null if none. */
  strike: Position | null;
  /** The freshly telegraphed meteor for the upcoming turn. */
  next: MeteorWarning;
}

/** Choose an interior impact tile for a meteor that will land on `strikeTurn`. */
export const chooseMeteorTarget = (strikeTurn: number, rng: Rng): MeteorWarning => ({
  target: {
    x: 1 + Math.floor(rng() * (BOARD_WIDTH - 2)),
    y: 1 + Math.floor(rng() * (BOARD_HEIGHT - 2)),
  },
  strikeTurn,
});

/**
 * Advance the meteor telegraph by one turn: the currently telegraphed meteor
 * (if any) lands now, and a fresh one is telegraphed for `upcomingTurn`. This is
 * the one-round warning - a meteor is always visible for a full round before it
 * strikes.
 */
export const advanceMeteor = (
  current: MeteorWarning | null,
  upcomingTurn: number,
  rng: Rng
): MeteorResolution => ({
  strike: current ? current.target : null,
  next: chooseMeteorTarget(upcomingTurn, rng),
});
