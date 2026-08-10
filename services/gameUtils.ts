import { Position, Player, TeamSide, PlayerRole } from "../types";
import { ROLE_STATS } from "../constants";
import {
  Rng,
  rollDie,
  manhattanDistance,
  resolveTackle as resolveTacklePure,
  resolvePass as resolvePassPure,
  scatterPosition as scatterPositionPure,
} from "./rules";

// Real-game wrappers around the pure logic in `rules.ts`. These bind the
// injectable rng to `Math.random`, so the app keeps its existing behaviour
// while the rules themselves stay deterministically testable.

const defaultRng: Rng = () => Math.random();

export const INITIAL_MANA = 5;

// rng-free helpers are re-exported unchanged from the pure module.
export { isPositionValid, isAdjacent, getPlayerAtPosition } from "./rules";

/** Manhattan distance (kept under its historical name for existing callers). */
export const getDistance = manhattanDistance;

export const createPlayer = (
  id: string,
  name: string,
  role: PlayerRole,
  team: TeamSide,
  x: number,
  y: number
): Player => {
  return {
    id,
    name,
    role,
    team,
    position: { x, y },
    stats: ROLE_STATS[role],
    hasBall: false,
    isStunned: false,
    movesRemaining: ROLE_STATS[role].move,
    actionTaken: false,
    mana: role === PlayerRole.WIZARD ? INITIAL_MANA : 0,
  };
};

export const rollDice = (sides: number = 6): number => rollDie(defaultRng, sides);

export const resolveTackle = (
  attacker: Player,
  defender: Player
): { success: boolean; log: string } => resolveTacklePure(attacker, defender, defaultRng);

export const resolvePass = (
  thrower: Player,
  targetPos: Position
): { success: boolean; log: string } => resolvePassPure(thrower, targetPos, defaultRng);

/** Scatter a loose ball using the real rng. */
export const scatterBall = (pos: Position): Position => scatterPositionPure(pos, defaultRng);
