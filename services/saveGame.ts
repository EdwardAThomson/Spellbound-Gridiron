import { GameState, TeamSide, TerrainType, Weather } from '../types';

// Versioned localStorage save/load for a single game slot.
//
// The whole GameState plus the UI-level `hasGameStarted` flag are persisted
// under one versioned key so a saved match restores exactly, including the
// board, ball, scores, log and commentary. Serialization is plain JSON: every
// field on GameState is a JSON-native value (string enums, numbers, arrays,
// nested position objects, or null), so a stringify/parse cycle is lossless.
//
// The store is injected (defaulting to the browser's localStorage) so the pure
// serialize/deserialize logic stays unit-testable in a node environment with no
// Web Storage API. Nothing here autosaves: callers save only on an explicit
// Save action, so a running game never overwrites the slot on its own.

/** Bump this whenever the persisted shape changes; old saves are then rejected. */
// v2 added terrain hazard tiles and the meteor telegraph to the snapshot.
// v3 added per-player XP and level (the progression system). Old v1/v2 saves,
// whose players carry no XP/level, are rejected gracefully by the version guard
// rather than loaded into a half-initialised progression state.
export const SAVE_VERSION = 3;

/** The single localStorage key holding the save slot. */
export const SAVE_KEY = 'spellbound_gridiron_save_v3';

/** The persisted envelope: a version tag wrapping the full game snapshot. */
export interface SaveEnvelope {
  version: number;
  hasGameStarted: boolean;
  gameState: GameState;
}

/** The subset of the Web Storage API this module relies on. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export interface LoadResult {
  ok: boolean;
  hasGameStarted?: boolean;
  gameState?: GameState;
  /** Present when `ok` is false: why the load failed (missing vs corrupt). */
  error?: string;
}

/** The browser's localStorage, or null when running outside a browser. */
export const browserStore: KeyValueStore | null =
  typeof localStorage !== 'undefined' ? localStorage : null;

/** Serialize a snapshot into the versioned JSON envelope written to storage. */
export const serializeSave = (
  gameState: GameState,
  hasGameStarted: boolean
): string => {
  const envelope: SaveEnvelope = {
    version: SAVE_VERSION,
    hasGameStarted,
    gameState,
  };
  return JSON.stringify(envelope);
};

// Structural guards. A save is only accepted if it carries the current version
// and a game snapshot shaped the way the app expects, so a truncated,
// hand-edited or stale-version blob degrades to "no usable save" rather than
// loading a half-broken board.

const isPosition = (v: any): boolean =>
  v === null || (v && typeof v.x === 'number' && typeof v.y === 'number');

const isConcretePosition = (v: any): boolean =>
  v && typeof v.x === 'number' && typeof v.y === 'number';

const isMeteor = (v: any): boolean =>
  v === null || (v && isConcretePosition(v.target) && typeof v.strikeTurn === 'number');

const isTeamData = (v: any): boolean =>
  v &&
  typeof v.name === 'string' &&
  typeof v.race === 'string' &&
  typeof v.score === 'number' &&
  Array.isArray(v.players);

const isGameState = (v: any): v is GameState =>
  v &&
  typeof v.turn === 'number' &&
  (v.currentTeam === TeamSide.HOME || v.currentTeam === TeamSide.AWAY) &&
  isTeamData(v.homeTeam) &&
  isTeamData(v.awayTeam) &&
  (v.selectedPlayerId === null || typeof v.selectedPlayerId === 'string') &&
  isPosition(v.ballPosition) &&
  typeof v.boardWidth === 'number' &&
  typeof v.boardHeight === 'number' &&
  Object.values(TerrainType).includes(v.terrain) &&
  Object.values(Weather).includes(v.weather) &&
  Array.isArray(v.hazards) &&
  v.hazards.every(isConcretePosition) &&
  isMeteor(v.meteor) &&
  Array.isArray(v.gameLog) &&
  typeof v.commentary === 'string' &&
  typeof v.isGameOver === 'boolean' &&
  (v.winner === null || v.winner === TeamSide.HOME || v.winner === TeamSide.AWAY);

/** Parse and validate a raw save blob, never throwing on bad input. */
export const deserializeSave = (raw: string | null): LoadResult => {
  if (raw == null) {
    return { ok: false, error: 'No saved game found.' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Saved game is corrupt and could not be read.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Saved game is corrupt and could not be read.' };
  }
  if (parsed.version !== SAVE_VERSION) {
    return { ok: false, error: 'Saved game is from an incompatible version.' };
  }
  if (typeof parsed.hasGameStarted !== 'boolean' || !isGameState(parsed.gameState)) {
    return { ok: false, error: 'Saved game is corrupt and could not be read.' };
  }

  return {
    ok: true,
    hasGameStarted: parsed.hasGameStarted,
    gameState: parsed.gameState,
  };
};

/** True when a save slot exists (regardless of whether it is valid). */
export const hasSave = (store: KeyValueStore | null = browserStore): boolean =>
  store != null && store.getItem(SAVE_KEY) != null;

/** Write the current snapshot to the slot. Swallows storage errors as a result. */
export const saveGame = (
  gameState: GameState,
  hasGameStarted: boolean,
  store: KeyValueStore | null = browserStore
): SaveResult => {
  if (!store) {
    return { ok: false, error: 'Saving is unavailable in this environment.' };
  }
  try {
    store.setItem(SAVE_KEY, serializeSave(gameState, hasGameStarted));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not write the save (storage full or blocked).' };
  }
};

/** Read and validate the slot. Missing or corrupt saves come back as `ok: false`. */
export const loadGame = (
  store: KeyValueStore | null = browserStore
): LoadResult => {
  if (!store) {
    return { ok: false, error: 'Loading is unavailable in this environment.' };
  }
  let raw: string | null;
  try {
    raw = store.getItem(SAVE_KEY);
  } catch {
    return { ok: false, error: 'Could not read the save slot.' };
  }
  return deserializeSave(raw);
};
