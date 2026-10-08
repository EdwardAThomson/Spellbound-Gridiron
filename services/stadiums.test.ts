import { describe, it, expect } from 'vitest';
import {
  STADIUMS,
  NEUTRAL_STADIUM,
  homeStadium,
  stadiumForTerrain,
  rollStadiumWeather,
  fixtureVenue,
  Stadium,
} from './stadiums';
import { DEFAULT_CAMPAIGN_TEAMS, generateFixtures, Fixture } from './campaign';
import { seededRng } from './rules';
import { TerrainType, Weather } from '../types';

const fixture = (homeId: string, awayId: string, round = 1): Fixture => ({
  round, homeId, awayId, homeScore: null, awayScore: null, played: false,
});

describe('stadium data', () => {
  it('gives every default campaign club its own home stadium', () => {
    for (const team of DEFAULT_CAMPAIGN_TEAMS) {
      const s = homeStadium(team.id);
      expect(s).not.toBe(NEUTRAL_STADIUM);
      expect(s.clubId).toBe(team.id);
    }
  });

  // Pitches may repeat: there are only four terrains, so a fifth club shares one.
  it('has unique ids and one stadium per club', () => {
    const ids = STADIUMS.map((s) => s.id);
    const clubs = STADIUMS.map((s) => s.clubId);
    expect(new Set(ids).size).toBe(STADIUMS.length);
    expect(new Set(clubs).size).toBe(STADIUMS.length);
  });

  it('matches each club to its race pitch', () => {
    expect(homeStadium('elves').terrain).toBe(TerrainType.GRASS);
    expect(homeStadium('orcs').terrain).toBe(TerrainType.MUD);
    expect(homeStadium('dwarves').terrain).toBe(TerrainType.LAVA);
    expect(homeStadium('undead').terrain).toBe(TerrainType.ICE);
  });

  it('gives every climate a positive total weight and no negative weights', () => {
    for (const s of [...STADIUMS, NEUTRAL_STADIUM]) {
      const weights = Object.values(s.climate);
      expect(weights.every((w) => w >= 0)).toBe(true);
      expect(weights.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    }
  });

  it('falls back to the neutral ground (Grass) for an unknown club', () => {
    expect(homeStadium('nobody')).toBe(NEUTRAL_STADIUM);
    expect(NEUTRAL_STADIUM.terrain).toBe(TerrainType.GRASS);
  });
});

describe('rollStadiumWeather', () => {
  it('never rolls a weather with zero weight', () => {
    const elves = homeStadium('elves'); // Blizzard weight 0
    const rng = seededRng(42);
    for (let i = 0; i < 500; i++) expect(rollStadiumWeather(elves, rng)).not.toBe(Weather.BLIZZARD);
  });

  it('maps the rng onto the weights in order', () => {
    const s: Stadium = {
      ...NEUTRAL_STADIUM,
      climate: { [Weather.CLEAR]: 1, [Weather.RAIN]: 1, [Weather.BLIZZARD]: 1, [Weather.METEOR_SHOWER]: 1 },
    };
    expect(rollStadiumWeather(s, () => 0)).toBe(Weather.CLEAR);
    expect(rollStadiumWeather(s, () => 0.3)).toBe(Weather.RAIN);
    expect(rollStadiumWeather(s, () => 0.6)).toBe(Weather.BLIZZARD);
    expect(rollStadiumWeather(s, () => 0.99)).toBe(Weather.METEOR_SHOWER);
    expect(rollStadiumWeather(s, () => 1)).toBe(Weather.METEOR_SHOWER);
  });

  it('skips zero-weight weathers even at the edges', () => {
    const s: Stadium = {
      ...NEUTRAL_STADIUM,
      climate: { [Weather.CLEAR]: 0, [Weather.RAIN]: 2, [Weather.BLIZZARD]: 0, [Weather.METEOR_SHOWER]: 0 },
    };
    expect(rollStadiumWeather(s, () => 0)).toBe(Weather.RAIN);
    expect(rollStadiumWeather(s, () => 1)).toBe(Weather.RAIN);
  });

  it('falls back to Clear when every weight is zero', () => {
    const s: Stadium = {
      ...NEUTRAL_STADIUM,
      climate: { [Weather.CLEAR]: 0, [Weather.RAIN]: 0, [Weather.BLIZZARD]: 0, [Weather.METEOR_SHOWER]: 0 },
    };
    expect(rollStadiumWeather(s, () => 0.5)).toBe(Weather.CLEAR);
  });

  it('roughly follows the climate weights', () => {
    const undead = homeStadium('undead');
    const rng = seededRng(7);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      const w = rollStadiumWeather(undead, rng);
      counts[w] = (counts[w] ?? 0) + 1;
    }
    // Blizzard carries half the weight at Barrowfrost.
    expect(counts[Weather.BLIZZARD] / 4000).toBeGreaterThan(0.4);
    expect(counts[Weather.BLIZZARD] / 4000).toBeLessThan(0.6);
  });
});

describe('fixtureVenue', () => {
  it("plays at the home club's stadium", () => {
    expect(fixtureVenue(1, fixture('orcs', 'elves')).stadium.id).toBe('the-gutterpit');
    expect(fixtureVenue(1, fixture('elves', 'orcs')).stadium.id).toBe('moonglade-bowl');
  });

  it('is reproducible for the same season and fixture', () => {
    const f = fixture('undead', 'dwarves', 3);
    expect(fixtureVenue(2, f)).toEqual(fixtureVenue(2, { ...f }));
  });

  it('varies the forecast across a season', () => {
    const fixtures = generateFixtures(DEFAULT_CAMPAIGN_TEAMS.map((t) => t.id));
    const forecasts = new Set<Weather>();
    for (let season = 1; season <= 5; season++) {
      for (const f of fixtures) forecasts.add(fixtureVenue(season, f).weather);
    }
    expect(forecasts.size).toBeGreaterThan(1);
  });

  it("only forecasts weather the home stadium's climate allows", () => {
    const fixtures = generateFixtures(DEFAULT_CAMPAIGN_TEAMS.map((t) => t.id));
    for (let season = 1; season <= 10; season++) {
      for (const f of fixtures) {
        const { stadium, weather } = fixtureVenue(season, f);
        expect(stadium.climate[weather]).toBeGreaterThan(0);
      }
    }
  });
});

describe('stadiumForTerrain', () => {
  it('frames each pitch with the club stadium built on it', () => {
    expect(stadiumForTerrain(TerrainType.GRASS).id).toBe('moonglade-bowl');
    expect(stadiumForTerrain(TerrainType.MUD).id).toBe('the-gutterpit');
    expect(stadiumForTerrain(TerrainType.LAVA).id).toBe('anvilhold-forge');
    expect(stadiumForTerrain(TerrainType.ICE).id).toBe('barrowfrost');
  });
});
