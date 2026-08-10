import { Position, Player, BOARD_WIDTH, BOARD_HEIGHT } from '../types';

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

/**
 * Distance metric currently used for pass difficulty. This preserves the
 * historical floored-Euclidean behaviour; Task 1 reconciles it with the
 * rulebook's documented `2 + manhattan_distance`.
 */
export const passDistance = (from: Position, to: Position): number =>
  Math.floor(Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2));

export interface PassResult {
  success: boolean;
  roll: number;
  difficulty: number;
  log: string;
}

/** SKL + d6 vs a distance-scaled difficulty; success on roll >= difficulty. */
export const resolvePass = (
  thrower: Player,
  targetPos: Position,
  rng: Rng
): PassResult => {
  const difficulty = 2 + passDistance(thrower.position, targetPos);
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
