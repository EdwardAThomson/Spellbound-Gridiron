import { Position, Player, TeamSide, BOARD_WIDTH, BOARD_HEIGHT } from '../types';

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
 * SKL + d6 vs `2 + manhattan_distance`; success on roll >= difficulty.
 * The difficulty metric is Manhattan (grid) distance to match the rulebook
 * (`GAME_RULES` in utils/contextSerializer.ts) and CLAUDE.md.
 */
export const resolvePass = (
  thrower: Player,
  targetPos: Position,
  rng: Rng
): PassResult => {
  const difficulty = 2 + manhattanDistance(thrower.position, targetPos);
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
