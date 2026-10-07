import { Position, Player, TeamSide, PlayerRole, TerrainType, Weather, MeteorWarning } from "../types";
import { ROLE_STATS } from "../constants";
import {
  Rng,
  rollDie,
  manhattanDistance,
  resolveTackle as resolveTacklePure,
  resolvePass as resolvePassPure,
  scatterPosition as scatterPositionPure,
  weatherPassModifier,
  resolveTerrainStep as resolveTerrainStepPure,
  generateLavaHazards as generateLavaHazardsPure,
  advanceMeteor as advanceMeteorPure,
  resolveLevelUps as resolveLevelUpsPure,
  resolveKnockdown as resolveKnockdownPure,
  KnockdownSource,
  KnockdownResult,
  StepEffect,
  MeteorResolution,
  TackleResult,
  XpAward,
  LAVA_HAZARD_COUNT,
} from "./rules";

// Real-game wrappers around the pure logic in `rules.ts`. These bind the
// injectable rng to `Math.random`, so the app keeps its existing behaviour
// while the rules themselves stay deterministically testable.

const defaultRng: Rng = () => Math.random();

export const INITIAL_MANA = 5;

// rng-free helpers are re-exported unchanged from the pure module.
export {
  isPositionValid,
  isAdjacent,
  getPlayerAtPosition,
  checkWinner,
  validateSpellCast,
  isHazard,
  weatherPassModifier,
  weatherMovePenalty,
  effectiveMove,
  kickoffPosition,
  FORMATION_X,
  findPath,
  reachableTiles,
  WIN_SCORE,
  MAX_TURNS,
  LAVA_HAZARD_COUNT,
  XP_AWARDS,
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  MAX_STAT_BUMP,
  ROLE_GROWTH,
  levelForXp,
  bankXp,
  extractRoster,
  applyRoster,
  isRoster,
  ROSTER_VERSION,
  ARMOR_SAVE_TARGET,
  turnMove,
} from "./rules";
export type { StepEffect, MeteorResolution, XpAward, Roster, RosterPlayer, KnockdownSource, KnockdownResult, TackleResult } from "./rules";
export {
  SKILLS,
  hasSkill,
  canUseSkill,
  spendSkill,
  downPlayer,
  keepsBallWhenDowned,
  startingMana,
  manaSparkCap,
  spellRange,
} from "./skills";

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
    xp: 0,
    level: 1,
    skills: [],
    spentSkills: [],
    movedThisTurn: 0,
    movePenalty: 0,
  };
};

export const rollDice = (sides: number = 6): number => rollDie(defaultRng, sides);

/** Resolve a tackle with the real rng; pass everyone on the pitch to apply skills. */
export const resolveTackle = (
  attacker: Player,
  defender: Player,
  players?: Player[]
): TackleResult => resolveTacklePure(attacker, defender, defaultRng, players);

/** Resolve a pass with the real rng; pass everyone on the pitch to apply skills. */
export const resolvePass = (
  thrower: Player,
  targetPos: Position,
  weather: Weather = Weather.CLEAR,
  players?: Player[]
): { success: boolean; log: string } =>
  resolvePassPure(thrower, targetPos, defaultRng, weatherPassModifier(weather), players ? { weather, players } : undefined);

/** Scatter a loose ball using the real rng. */
export const scatterBall = (pos: Position): Position => scatterPositionPure(pos, defaultRng);

/** Resolve a terrain step (mud slip / lava hazard / ice slide) with the real rng. */
export const resolveTerrainStep = (
  terrain: TerrainType,
  from: Position,
  to: Position,
  hazards: Position[],
  isBlocked: (pos: Position) => boolean,
  mover?: Player
): StepEffect => resolveTerrainStepPure(terrain, from, to, hazards, isBlocked, defaultRng, mover);

/** Seed a Lava pitch's hazard tiles using the real rng. */
export const generateLavaHazards = (count: number = LAVA_HAZARD_COUNT): Position[] =>
  generateLavaHazardsPure(count, defaultRng);

/** Advance the meteor telegraph one turn using the real rng. */
export const advanceMeteor = (
  current: MeteorWarning | null,
  upcomingTurn: number
): MeteorResolution => advanceMeteorPure(current, upcomingTurn, defaultRng);

/** Resolve a player's banked XP into level-ups (between games) with the real rng. */
export const resolveLevelUps = (player: Player): XpAward =>
  resolveLevelUpsPure(player, defaultRng);

/** Resolve a non-tackle knockdown's armor save with the real rng. */
export const resolveKnockdown = (player: Player, source: KnockdownSource): KnockdownResult =>
  resolveKnockdownPure(player, source, defaultRng);
