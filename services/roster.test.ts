import { describe, it, expect } from 'vitest';
import {
  extractRoster,
  applyRoster,
  isRoster,
  ROSTER_VERSION,
  Roster,
} from './rules';
import {
  ROSTER_KEY,
  serializeRosters,
  deserializeRosters,
  saveRosters,
  loadRosters,
} from './roster';
import { KeyValueStore } from './saveGame';
import { Player, PlayerRole, TeamSide, TeamData } from '../types';

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
  hasBall: false,
  isStunned: false,
  movesRemaining: 4,
  actionTaken: false,
  mana: 0,
  xp: 0,
  level: 1,
  ...over,
});

// A team that has been through a match: two players carry earned XP, levels and
// bumped stats, one is still a rookie.
const mkTeam = (): TeamData => ({
  name: 'Elven Vanguard',
  race: 'High Elves',
  color: 'blue',
  score: 14,
  players: [
    mkPlayer({ id: 'HOME-0', xp: 7, level: 2, stats: { move: 4, strength: 5, skill: 2, armor: 9 } }),
    mkPlayer({ id: 'HOME-3', name: 'Catcher 4', role: PlayerRole.CATCHER, xp: 12, level: 3, stats: { move: 9, strength: 3, skill: 8, armor: 7 } }),
    mkPlayer({ id: 'HOME-4', name: 'Wizard 5', role: PlayerRole.WIZARD, mana: 5, xp: 0, level: 1, stats: { move: 5, strength: 3, skill: 6, armor: 8 } }),
  ],
});

// Fresh, match-start players (formation positions, full moves, no XP) that a
// rematch would create before overlaying a roster onto them.
const freshPlayers = (): Player[] => [
  mkPlayer({ id: 'HOME-0', name: 'Lineman 1', position: { x: 2, y: 1 }, stats: { move: 4, strength: 4, skill: 2, armor: 9 } }),
  mkPlayer({ id: 'HOME-3', name: 'Catcher 4', role: PlayerRole.CATCHER, position: { x: 8, y: 1 }, movesRemaining: 8, stats: { move: 8, strength: 3, skill: 7, armor: 7 } }),
  mkPlayer({ id: 'HOME-4', name: 'Wizard 5', role: PlayerRole.WIZARD, position: { x: 10, y: 1 }, movesRemaining: 5, mana: 5, stats: { move: 5, strength: 3, skill: 6, armor: 8 } }),
];

describe('roster round-trip fidelity', () => {
  it('extract -> serialize -> deserialize preserves every slot exactly', () => {
    const roster = extractRoster(mkTeam());
    const restored = deserializeRosters(serializeRosters({ home: roster, away: roster }));
    expect(restored.ok).toBe(true);
    expect(restored.slots!.home).toEqual(roster);
    expect(restored.slots!.away).toEqual(roster);
  });

  it('persists both team slots through the storage round trip', () => {
    const store = memStore();
    const home = extractRoster(mkTeam());
    const away = extractRoster({ ...mkTeam(), name: 'Orc Bashers', race: 'Dark Orcs', color: 'red' });

    expect(saveRosters({ home, away }, store)).toEqual({ ok: true });
    const loaded = loadRosters(store);
    expect(loaded.ok).toBe(true);
    expect(loaded.slots!.home).toEqual(home);
    expect(loaded.slots!.away).toEqual(away);
  });

  it('writes under the versioned key with the current version tag', () => {
    const store = memStore();
    const roster = extractRoster(mkTeam());
    saveRosters({ home: roster, away: roster }, store);
    const raw = store.map.get(ROSTER_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).version).toBe(ROSTER_VERSION);
  });

  it('carries XP, level and bumped stats onto fresh rematch players', () => {
    const roster = extractRoster(mkTeam());
    const rebuilt = applyRoster(roster, freshPlayers());

    const catcher = rebuilt.find((p) => p.id === 'HOME-3')!;
    // Progression is restored...
    expect(catcher.xp).toBe(12);
    expect(catcher.level).toBe(3);
    expect(catcher.stats).toEqual({ move: 9, strength: 3, skill: 8, armor: 7 });
    // ...while match-specific fields stay fresh.
    expect(catcher.position).toEqual({ x: 8, y: 1 });

    const wizard = rebuilt.find((p) => p.id === 'HOME-4')!;
    expect(wizard.xp).toBe(0);
    expect(wizard.level).toBe(1);
    expect(wizard.mana).toBe(5);
  });

  it('leaves fresh players untouched when the roster has no matching id', () => {
    const roster = extractRoster(mkTeam());
    const stranger = [mkPlayer({ id: 'HOME-9', xp: 0, level: 1 })];
    const rebuilt = applyRoster(roster, stranger);
    expect(rebuilt[0].xp).toBe(0);
    expect(rebuilt[0].level).toBe(1);
  });
});

describe('graceful handling of missing / corrupt rosters', () => {
  it('reports a missing slot without throwing', () => {
    const store = memStore();
    const loaded = loadRosters(store);
    expect(loaded.ok).toBe(false);
    expect(loaded.slots).toBeUndefined();
    expect(loaded.error).toMatch(/no saved rosters/i);
  });

  it('rejects non-JSON garbage', () => {
    const r = deserializeRosters('{not valid json');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/corrupt/i);
  });

  it('rejects an incompatible version', () => {
    const roster = extractRoster(mkTeam());
    const bad = JSON.stringify({ version: ROSTER_VERSION + 1, slots: { home: roster, away: roster } });
    const r = deserializeRosters(bad);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/version/i);
  });

  it('rejects a structurally broken slot', () => {
    const roster = extractRoster(mkTeam());
    const bad = JSON.stringify({ version: ROSTER_VERSION, slots: { home: roster, away: { name: 'x' } } });
    expect(deserializeRosters(bad).ok).toBe(false);
  });

  it('isRoster rejects a malformed roster', () => {
    expect(isRoster(null)).toBe(false);
    expect(isRoster({ name: 'x', race: 'y', color: 'z', players: [{ id: 1 }] } as unknown as Roster)).toBe(false);
  });
});
