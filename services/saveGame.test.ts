import { describe, it, expect } from 'vitest';
import {
  SAVE_KEY,
  SAVE_VERSION,
  KeyValueStore,
  serializeSave,
  deserializeSave,
  saveGame,
  loadGame,
  hasSave,
} from './saveGame';
import {
  GameState,
  TeamSide,
  TerrainType,
  Weather,
  PlayerRole,
  Player,
  TeamData,
  BOARD_WIDTH,
  BOARD_HEIGHT,
} from '../types';

// A tiny in-memory Web Storage stand-in for the node test environment.
const memStore = (): KeyValueStore & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
};

const mkPlayer = (over: Partial<Player> = {}): Player => ({
  id: 'HOME-0',
  name: 'Lineman 1',
  role: PlayerRole.LINEMAN,
  team: TeamSide.HOME,
  position: { x: 2, y: 3 },
  stats: { move: 4, strength: 4, skill: 2, armor: 9 },
  hasBall: true,
  isStunned: false,
  movesRemaining: 2,
  actionTaken: true,
  mana: 0,
  ...over,
});

const mkTeam = (over: Partial<TeamData> = {}): TeamData => ({
  name: 'Elven Vanguard',
  race: 'High Elves',
  color: 'blue',
  score: 14,
  players: [mkPlayer(), mkPlayer({ id: 'HOME-1', name: 'Wizard', role: PlayerRole.WIZARD, mana: 5, hasBall: false })],
  ...over,
});

const mkState = (over: Partial<GameState> = {}): GameState => ({
  turn: 7,
  currentTeam: TeamSide.AWAY,
  homeTeam: mkTeam(),
  awayTeam: mkTeam({ name: 'Orc Bashers', race: 'Dark Orcs', color: 'red', score: 7 }),
  selectedPlayerId: 'HOME-1',
  ballPosition: { x: 6, y: 9 },
  boardWidth: BOARD_WIDTH,
  boardHeight: BOARD_HEIGHT,
  terrain: TerrainType.MUD,
  weather: Weather.RAIN,
  gameLog: ['The mystical gates open!', 'Lineman 1 picked up the ball!'],
  commentary: 'What a play, folks!',
  isGameOver: false,
  winner: null,
  ...over,
});

describe('save round-trip fidelity', () => {
  it('restores a full snapshot exactly, including hasGameStarted', () => {
    const store = memStore();
    const state = mkState();

    expect(saveGame(state, true, store)).toEqual({ ok: true });

    const loaded = loadGame(store);
    expect(loaded.ok).toBe(true);
    expect(loaded.hasGameStarted).toBe(true);
    // Deep, exact equality across the whole state tree.
    expect(loaded.gameState).toEqual(state);
  });

  it('round-trips a held ball (null ballPosition) and a finished game', () => {
    const store = memStore();
    const state = mkState({
      ballPosition: null,
      isGameOver: true,
      winner: TeamSide.HOME,
    });
    saveGame(state, true, store);
    const loaded = loadGame(store);
    expect(loaded.gameState).toEqual(state);
  });

  it('writes under the versioned key with the current version tag', () => {
    const store = memStore();
    saveGame(mkState(), false, store);
    const raw = store.map.get(SAVE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).version).toBe(SAVE_VERSION);
    expect(JSON.parse(raw!).hasGameStarted).toBe(false);
  });
});

describe('graceful handling of missing / corrupt saves', () => {
  it('reports a missing slot without throwing', () => {
    const store = memStore();
    expect(hasSave(store)).toBe(false);
    const loaded = loadGame(store);
    expect(loaded.ok).toBe(false);
    expect(loaded.gameState).toBeUndefined();
    expect(loaded.error).toMatch(/no saved game/i);
  });

  it('rejects non-JSON garbage', () => {
    expect(deserializeSave('{not valid json').ok).toBe(false);
    expect(deserializeSave('{not valid json').error).toMatch(/corrupt/i);
  });

  it('rejects an incompatible version', () => {
    const bad = JSON.stringify({ version: SAVE_VERSION + 1, hasGameStarted: true, gameState: mkState() });
    const r = deserializeSave(bad);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/version/i);
  });

  it('rejects a structurally broken snapshot', () => {
    const bad = JSON.stringify({ version: SAVE_VERSION, hasGameStarted: true, gameState: { turn: 'oops' } });
    expect(deserializeSave(bad).ok).toBe(false);
  });

  it('does not clobber an existing valid save when a load fails to parse', () => {
    const store = memStore();
    saveGame(mkState(), true, store);
    // A failed load is read-only: the good save is still intact afterwards.
    deserializeSave(store.map.get(SAVE_KEY)! + 'trailing garbage');
    expect(loadGame(store).ok).toBe(true);
  });
});

describe('serializeSave', () => {
  it('produces a parseable envelope carrying version, flag and state', () => {
    const env = JSON.parse(serializeSave(mkState(), true));
    expect(env.version).toBe(SAVE_VERSION);
    expect(env.hasGameStarted).toBe(true);
    expect(env.gameState.turn).toBe(7);
  });
});
