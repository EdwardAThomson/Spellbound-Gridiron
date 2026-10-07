import { TerrainType, Weather } from '../types';
import { Rng, seededRng } from './rules';
import { Fixture, fixtureSeed } from './campaign';

// Per-club home stadia for the campaign. Each club plays its home fixtures at
// its own venue: the venue fixes the pitch (a terrain type, so it changes how
// play works) and has a local climate, a weighting over the four weathers that
// a fixture's forecast is rolled from. Everything here is plain data plus pure,
// rng-injected helpers; `components/StadiumArt.tsx` draws each venue.
//
// Venues are keyed by campaign team id, so the campaign save shape is untouched:
// a club's stadium is looked up, never stored.

/** Relative weights of each weather at a venue. Zero means it never happens there. */
export type Climate = Record<Weather, number>;

export interface Stadium {
  /** Stable id, also the key `StadiumArt` draws by. */
  id: string;
  /** The campaign team id whose home this is (empty for the neutral ground). */
  clubId: string;
  name: string;
  /** One-line flavour shown under the name. */
  tagline: string;
  /** The pitch the home club plays on. */
  terrain: TerrainType;
  climate: Climate;
}

export const STADIUMS: Stadium[] = [
  {
    id: 'moonglade-bowl',
    clubId: 'elves',
    name: 'Moonglade Bowl',
    tagline: 'A living amphitheatre of silver-barked trees, lit by lanterns and moonlight.',
    terrain: TerrainType.GRASS,
    climate: { [Weather.CLEAR]: 6, [Weather.RAIN]: 3, [Weather.BLIZZARD]: 0, [Weather.METEOR_SHOWER]: 1 },
  },
  {
    id: 'the-gutterpit',
    clubId: 'orcs',
    name: 'The Gutterpit',
    tagline: 'A sunken mud bowl ringed by spiked palisades and a crowd that throws things.',
    terrain: TerrainType.MUD,
    climate: { [Weather.CLEAR]: 3, [Weather.RAIN]: 5, [Weather.BLIZZARD]: 1, [Weather.METEOR_SHOWER]: 1 },
  },
  {
    id: 'anvilhold-forge',
    clubId: 'dwarves',
    name: 'Anvilhold Forge-Ring',
    tagline: 'Carved deep under the mountain, where molten channels run between the yard lines.',
    terrain: TerrainType.LAVA,
    climate: { [Weather.CLEAR]: 5, [Weather.RAIN]: 1, [Weather.BLIZZARD]: 0, [Weather.METEOR_SHOWER]: 4 },
  },
  {
    id: 'barrowfrost',
    clubId: 'undead',
    name: 'Barrowfrost Necropolis',
    tagline: 'A frozen graveyard under a green aurora. The home fans never leave.',
    terrain: TerrainType.ICE,
    climate: { [Weather.CLEAR]: 2, [Weather.RAIN]: 1, [Weather.BLIZZARD]: 5, [Weather.METEOR_SHOWER]: 2 },
  },
];

/** The fallback venue for a club with no stadium of its own: plain Grass, always Clear. */
export const NEUTRAL_STADIUM: Stadium = {
  id: 'neutral-ground',
  clubId: '',
  name: 'The Neutral Ground',
  tagline: 'An ordinary field on the league road.',
  terrain: TerrainType.GRASS,
  climate: { [Weather.CLEAR]: 1, [Weather.RAIN]: 0, [Weather.BLIZZARD]: 0, [Weather.METEOR_SHOWER]: 0 },
};

/** The stadium a club plays its home fixtures at (the neutral ground if it has none). */
export const homeStadium = (clubId: string): Stadium =>
  STADIUMS.find((s) => s.clubId === clubId) ?? NEUTRAL_STADIUM;

const WEATHER_ORDER: Weather[] = [Weather.CLEAR, Weather.RAIN, Weather.BLIZZARD, Weather.METEOR_SHOWER];

/**
 * Roll a weather from a venue's climate with the injected rng. A climate whose
 * weights are all zero (or negative) falls back to Clear.
 */
export const rollStadiumWeather = (stadium: Stadium, rng: Rng): Weather => {
  const weights = WEATHER_ORDER.map((w) => Math.max(0, stadium.climate[w] ?? 0));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return Weather.CLEAR;
  let roll = rng() * total;
  for (let i = 0; i < WEATHER_ORDER.length; i++) {
    if (weights[i] > 0 && roll < weights[i]) return WEATHER_ORDER[i];
    roll -= weights[i];
  }
  // Floating-point edge (roll landed exactly on the total): the last possible weather.
  for (let i = WEATHER_ORDER.length - 1; i >= 0; i--) if (weights[i] > 0) return WEATHER_ORDER[i];
  return Weather.CLEAR;
};

/** Where and in what weather a fixture is played. */
export interface FixtureVenue {
  stadium: Stadium;
  weather: Weather;
}

// Salt so a fixture's forecast is drawn from a different stream than its
// `simulateMatch` result (which seeds from the same fixture identity).
const WEATHER_SALT = 0x5eed_ca57;

/**
 * The venue for a fixture: the home club's stadium, with a forecast seeded from
 * the season and fixture identity. Pure and reproducible, so the hub can show
 * the forecast before kick-off and the match then plays in exactly that weather.
 */
export const fixtureVenue = (season: number, fixture: Fixture): FixtureVenue => {
  const stadium = homeStadium(fixture.homeId);
  const rng = seededRng(fixtureSeed(season, fixture) ^ WEATHER_SALT);
  return { stadium, weather: rollStadiumWeather(stadium, rng) };
};
