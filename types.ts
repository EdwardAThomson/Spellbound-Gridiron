export enum TeamSide {
  HOME = 'HOME',
  AWAY = 'AWAY'
}

export enum PlayerRole {
  BLITZER = 'Blitzer',
  QUARTERBACK = 'Quarterback',
  LINEMAN = 'Lineman',
  CATCHER = 'Catcher',
  WIZARD = 'Wizard'
}

export enum TerrainType {
  GRASS = 'GRASS',
  MUD = 'MUD',
  LAVA = 'LAVA',
  ICE = 'ICE'
}

export enum Weather {
  CLEAR = 'Clear',
  RAIN = 'Rain',
  BLIZZARD = 'Blizzard',
  METEOR_SHOWER = 'Meteor Shower'
}

export interface Position {
  x: number;
  y: number;
}

export interface PlayerStats {
  move: number;
  strength: number;
  skill: number;
  armor: number;
}

// Skill ids (catalog and rules in services/skills.ts). Kept here so Player can
// carry them without types.ts importing the services layer.
export type SkillId =
  | 'stonewall' | 'rune_guard' | 'bodyguard'
  | 'juggernaut' | 'charge' | 'frenzy'
  | 'slippery' | 'sure_hands' | 'sprint'
  | 'strong_arm' | 'storm_thrower' | 'quick_release'
  | 'deep_well' | 'far_caster' | 'hex' | 'mana_spark'
  | 'fleet' | 'starlit_aim' | 'leap'
  | 'brutal' | 'mudborn' | 'strip'
  | 'shoulder' | 'forge_born' | 'iron_hide'
  | 'unliving' | 'grave_chill' | 'ice_skater'
  | 'rally' | 'drilled' | 'ball_clamp';

/** The playable races, as stable ids (TeamData.race keeps the display name). */
export type RaceId = 'elves' | 'orcs' | 'dwarves' | 'undead' | 'humans';

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  team: TeamSide;
  position: Position;
  stats: PlayerStats;
  hasBall: boolean;
  isStunned: boolean;
  movesRemaining: number;
  actionTaken: boolean;
  mana: number;
  // Progression: XP accrues from a player's plays (tackles, passes, spell casts,
  // touchdowns) and pushes them up levels, each level granting a small,
  // role-capped stat bump. Both persist across save/load and (later) rosters.
  xp: number;
  level: number;
  // Skills: learned skills persist in rosters (max 2). The rest is match-only
  // state: once-per-match skills already used, squares moved this turn (for
  // Juggernaut), and a one-turn Move penalty (from a Hex) applied at the next
  // turn refresh.
  skills: SkillId[];
  spentSkills: SkillId[];
  movedThisTurn: number;
  movePenalty: number;
}

export interface TeamData {
  name: string;
  race: string;
  color: string;
  players: Player[];
  score: number;
}

// A telegraphed incoming meteor (Meteor Shower weather). It is shown for one
// round before it strikes `target` on `strikeTurn`, giving players a warning to
// clear the tile. Persisted in save/load so a mid-shower match restores exactly.
export interface MeteorWarning {
  target: Position;
  strikeTurn: number;
}

export interface GameState {
  turn: number;
  currentTeam: TeamSide;
  homeTeam: TeamData;
  awayTeam: TeamData;
  selectedPlayerId: string | null;
  ballPosition: Position | null; // null if held by player
  boardWidth: number;
  boardHeight: number;
  terrain: TerrainType;
  weather: Weather;
  // Seeded lava hazard tiles (only populated on LAVA terrain). Stepping onto one
  // knocks the mover down. Deterministic per match and persisted in save/load.
  hazards: Position[];
  // The currently telegraphed meteor (Meteor Shower weather), or null.
  meteor: MeteorWarning | null;
  gameLog: string[];
  commentary: string;
  isGameOver: boolean;
  winner: TeamSide | null;
}

export const BOARD_WIDTH = 12;
export const BOARD_HEIGHT = 18; // Endzones are top and bottom rows
