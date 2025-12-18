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

export interface TeamData {
  name: string;
  race: string;
  color: string;
  players: Player[];
  score: number;
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
  gameLog: string[];
  commentary: string;
  isGameOver: boolean;
  winner: TeamSide | null;
}

export const BOARD_WIDTH = 12;
export const BOARD_HEIGHT = 18; // Endzones are top and bottom rows
