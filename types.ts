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

export enum SpellKey {
  FIREBALL = 'FIREBALL',
  TELEPORT = 'TELEPORT',
  HEAL = 'HEAL'
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

export enum GamePhase {
  MAIN_MENU = 'MAIN_MENU',
  TEAM_SELECT = 'TEAM_SELECT',
  PLAYING = 'PLAYING',
  POST_GAME = 'POST_GAME'
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

export interface SpellDefinition {
  name: string;
  cost: number;
  range: number;
  description: string;
}

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
}

/** Blueprint for a team — defines roster composition and theme. */
export interface TeamBlueprint {
  id: string;
  name: string;
  race: string;
  color: string;
  roster: PlayerRole[];
  description: string;
}

/** Runtime team data during a match. */
export interface TeamData {
  name: string;
  race: string;
  color: string;
  players: Player[];
  score: number;
  blueprintId: string;
}

export interface GameState {
  phase: GamePhase;
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
  gameLog: string[];
  commentary: string;
  isGameOver: boolean;
  winner: TeamSide | null;
}

export const BOARD_WIDTH = 12;
export const BOARD_HEIGHT = 18; // Endzones are top and bottom rows
