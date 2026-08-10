import { describe, it, expect } from 'vitest';
import {
  CampaignTeam,
  Fixture,
  CAMPAIGN_KEY,
  CAMPAIGN_VERSION,
  MAX_TOUCHDOWNS,
  TOUCHDOWN_POINTS,
  teamQuality,
  generateFixtures,
  computeStandings,
  simulateMatch,
  createCampaign,
  recordResult,
  isSeasonComplete,
  serializeCampaign,
  deserializeCampaign,
  saveCampaign,
  loadCampaign,
} from './campaign';
import { KeyValueStore } from './saveGame';
import { PlayerRole } from '../types';

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

// A small deterministic PRNG (mulberry32) so "fixed rng" tests are reproducible.
const seeded = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const TEAMS: CampaignTeam[] = [
  { id: 'A', name: 'Elven Vanguard', race: 'High Elves', color: 'blue', quality: 6 },
  { id: 'B', name: 'Orc Bashers', race: 'Dark Orcs', color: 'red', quality: 5 },
  { id: 'C', name: 'Dwarf Anvils', race: 'Dwarves', color: 'gold', quality: 4 },
  { id: 'D', name: 'Undead Legion', race: 'Undead', color: 'purple', quality: 3 },
];
const TEAM_IDS = TEAMS.map((t) => t.id);

describe('fixture generation (double round-robin)', () => {
  it('produces a non-empty set of exactly 12 fixtures for 4 teams', () => {
    const fixtures = generateFixtures(TEAM_IDS);
    expect(fixtures.length).toBeGreaterThan(0);
    expect(fixtures).toHaveLength(12);
  });

  it('has every ordered pair meet exactly once (each pair home and away)', () => {
    const fixtures = generateFixtures(TEAM_IDS);
    const seen = new Set(fixtures.map((f) => `${f.homeId}v${f.awayId}`));
    expect(seen.size).toBe(12); // all distinct
    for (const a of TEAM_IDS) {
      for (const b of TEAM_IDS) {
        if (a === b) continue;
        expect(seen.has(`${a}v${b}`)).toBe(true);
      }
    }
    // No team ever plays itself.
    expect(fixtures.some((f) => f.homeId === f.awayId)).toBe(false);
  });

  it('each team plays once per round (circle-method schedule)', () => {
    const fixtures = generateFixtures(TEAM_IDS);
    const byRound = new Map<number, string[]>();
    for (const f of fixtures) {
      const arr = byRound.get(f.round) ?? [];
      arr.push(f.homeId, f.awayId);
      byRound.set(f.round, arr);
    }
    expect(byRound.size).toBe(6); // (n-1) rounds per leg, two legs
    for (const teamsInRound of byRound.values()) {
      expect(new Set(teamsInRound).size).toBe(teamsInRound.length);
    }
  });

  it('rejects an odd team count rather than producing a lopsided schedule', () => {
    expect(() => generateFixtures(['A', 'B', 'C'])).toThrow();
  });
});

describe('rules-based simulator', () => {
  it('returns a deterministic score for a fixed rng', () => {
    const first = simulateMatch(TEAMS[0], TEAMS[3], seeded(42));
    const again = simulateMatch(TEAMS[0], TEAMS[3], seeded(42));
    expect(again).toEqual(first);
  });

  it('scores in touchdown points, capped at the game maximum', () => {
    for (let s = 0; s < 40; s++) {
      const { homeScore, awayScore } = simulateMatch(TEAMS[1], TEAMS[2], seeded(s));
      for (const score of [homeScore, awayScore]) {
        expect(score % TOUCHDOWN_POINTS).toBe(0);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(MAX_TOUCHDOWNS * TOUCHDOWN_POINTS);
      }
    }
  });

  it('lets the stronger team outscore the weaker one on average', () => {
    let strongWins = 0;
    let weakWins = 0;
    const strong: CampaignTeam = { ...TEAMS[0], quality: 10 };
    const weak: CampaignTeam = { ...TEAMS[3], quality: 2 };
    for (let s = 0; s < 200; s++) {
      const { homeScore, awayScore } = simulateMatch(strong, weak, seeded(s));
      if (homeScore > awayScore) strongWins++;
      else if (awayScore > homeScore) weakWins++;
    }
    expect(strongWins).toBeGreaterThan(weakWins);
  });
});

describe('team quality', () => {
  it('averages squad stats and floors an empty squad at 1', () => {
    const players = [
      { stats: { move: 4, strength: 4, skill: 2, armor: 6 } }, // mean 4
      { stats: { move: 6, strength: 6, skill: 6, armor: 6 } }, // mean 6
    ];
    expect(teamQuality(players)).toBe(5);
    expect(teamQuality([])).toBe(1);
    // Keep PlayerRole referenced so the enum import is meaningful to readers.
    expect(Object.values(PlayerRole).length).toBeGreaterThan(0);
  });
});

describe('3-1-0 standings', () => {
  const play = (fixtures: Fixture[], h: string, a: string, hs: number, as: number) =>
    recordResult(fixtures, h, a, { homeScore: hs, awayScore: as });

  it('awards 3 for a win, 1 each for a draw, 0 for a loss', () => {
    let fixtures = generateFixtures(TEAM_IDS);
    fixtures = play(fixtures, 'A', 'B', 14, 7); // A win
    fixtures = play(fixtures, 'C', 'D', 7, 7); // draw
    const table = computeStandings(TEAM_IDS, fixtures);
    const row = (id: string) => table.find((r) => r.teamId === id)!;

    expect(row('A').points).toBe(3);
    expect(row('A').won).toBe(1);
    expect(row('B').points).toBe(0);
    expect(row('B').lost).toBe(1);
    expect(row('C').points).toBe(1);
    expect(row('D').points).toBe(1);
    expect(row('C').drawn).toBe(1);
  });

  it('ignores unplayed fixtures and sorts leaders first', () => {
    let fixtures = generateFixtures(TEAM_IDS);
    fixtures = play(fixtures, 'A', 'B', 21, 0);
    fixtures = play(fixtures, 'A', 'C', 14, 7);
    const table = computeStandings(TEAM_IDS, fixtures);
    expect(table[0].teamId).toBe('A');
    expect(table[0].points).toBe(6);
    // Only A's two matches are counted; every other team has at most one played.
    expect(table.reduce((n, r) => n + r.played, 0)).toBe(4);
  });
});

describe('season lifecycle', () => {
  it('createCampaign lays out a full season for the given teams', () => {
    const campaign = createCampaign(TEAMS, 'A');
    expect(campaign.season).toBe(1);
    expect(campaign.playerTeamId).toBe('A');
    expect(campaign.fixtures).toHaveLength(12);
    expect(isSeasonComplete(campaign.fixtures)).toBe(false);
  });

  it('recordResult only fills the first matching unplayed fixture', () => {
    const fixtures = generateFixtures(TEAM_IDS);
    const after = recordResult(fixtures, 'A', 'B', { homeScore: 7, awayScore: 0 });
    const target = after.filter((f) => f.homeId === 'A' && f.awayId === 'B');
    expect(target).toHaveLength(1);
    expect(target[0].played).toBe(true);
    expect(target[0].homeScore).toBe(7);
    // Original list is untouched (immutability).
    expect(fixtures.find((f) => f.homeId === 'A' && f.awayId === 'B')!.played).toBe(false);
  });

  it('isSeasonComplete flips true only once every fixture is played', () => {
    let fixtures = generateFixtures(TEAM_IDS);
    for (const f of fixtures) {
      if (!f.played) fixtures = recordResult(fixtures, f.homeId, f.awayId, { homeScore: 7, awayScore: 0 });
    }
    expect(isSeasonComplete(fixtures)).toBe(true);
    expect(isSeasonComplete([])).toBe(false);
  });
});

describe('versioned persistence', () => {
  it('round-trips a campaign through storage', () => {
    const store = memStore();
    const campaign = createCampaign(TEAMS, 'B');
    expect(saveCampaign(campaign, store)).toEqual({ ok: true });

    const raw = store.map.get(CAMPAIGN_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).version).toBe(CAMPAIGN_VERSION);

    const loaded = loadCampaign(store);
    expect(loaded.ok).toBe(true);
    expect(loaded.campaign).toEqual(campaign);
  });

  it('reports a missing slot without throwing', () => {
    const loaded = loadCampaign(memStore());
    expect(loaded.ok).toBe(false);
    expect(loaded.campaign).toBeUndefined();
    expect(loaded.error).toMatch(/no saved campaign/i);
  });

  it('degrades on non-JSON garbage rather than throwing', () => {
    const r = deserializeCampaign('{not valid json');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/corrupt/i);
  });

  it('rejects an incompatible version', () => {
    const campaign = createCampaign(TEAMS, 'A');
    const bad = JSON.stringify({ version: CAMPAIGN_VERSION + 1, campaign });
    const r = deserializeCampaign(bad);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/version/i);
  });

  it('rejects a structurally broken campaign', () => {
    const bad = serializeCampaign({
      season: 1,
      playerTeamId: 'A',
      teams: [{ id: 'A' }] as any,
      fixtures: [],
    });
    expect(deserializeCampaign(bad).ok).toBe(false);
    // A whole-object nonsense payload also degrades, never throws.
    expect(deserializeCampaign(JSON.stringify({ version: CAMPAIGN_VERSION, campaign: 42 })).ok).toBe(false);
  });
});
