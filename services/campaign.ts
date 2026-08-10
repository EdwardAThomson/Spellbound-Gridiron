import { PlayerStats } from '../types';
import { Rng } from './rules';
import { KeyValueStore, browserStore } from './saveGame';

// Pure, rng-injected campaign (league) logic. Nothing here reads a global clock
// or a global RNG, and nothing here touches the DOM: the fixture generator,
// standings table, AI-vs-AI match simulator and localStorage envelope are all
// unit-testable in a node environment. The UI layer (a later item) wires these
// into a campaign hub; a fixed seed always produces the same league so an
// AI-vs-AI season is reproducible.
//
// This lives alongside, and is independent of, the single-match save
// (`saveGame.ts`) and the roster slots (`roster.ts`): a campaign persists its
// own season (teams, fixtures, results) under its own versioned key.

// --- Model -----------------------------------------------------------------

/**
 * A team in the league. `quality` is an overall strength rating the simulator
 * uses to derive AI-vs-AI scores; `teamQuality` computes one from a squad's
 * stats so a campaign hub can rate teams from their rosters.
 */
export interface CampaignTeam {
  id: string;
  name: string;
  race: string;
  color: string;
  quality: number;
}

/**
 * One league fixture. `homeScore`/`awayScore` are null until the match is
 * played (as a real player match or an AI-vs-AI simulation), at which point
 * `played` flips true and the scores are recorded in touchdown points.
 */
export interface Fixture {
  round: number;
  homeId: string;
  awayId: string;
  homeScore: number | null;
  awayScore: number | null;
  played: boolean;
}

/** A whole season: the four teams, their fixture list, and who the player is. */
export interface CampaignState {
  season: number;
  teams: CampaignTeam[];
  fixtures: Fixture[];
  playerTeamId: string;
}

/** The score of a resolved match, in touchdown points (multiples of 7). */
export interface MatchResult {
  homeScore: number;
  awayScore: number;
}

/** One row of the league table. */
export interface Standing {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  /** League points on the 3-1-0 (win-draw-loss) system. */
  points: number;
}

// --- Team quality ----------------------------------------------------------

/**
 * Rate a squad from its players' stats: the mean of each player's four stats,
 * averaged across the squad. An empty squad rates a floor of 1 so it still
 * fields a (weak) team in the simulator rather than dividing by zero.
 */
export const teamQuality = (players: { stats: PlayerStats }[]): number => {
  if (players.length === 0) return 1;
  const total = players.reduce(
    (sum, p) => sum + p.stats.move + p.stats.strength + p.stats.skill + p.stats.armor,
    0
  );
  return total / (players.length * 4);
};

// --- Fixtures --------------------------------------------------------------
//
// A double round-robin: every pair of teams meets twice, once at each team's
// home. For n teams that is n*(n-1) fixtures (4 teams -> 12). Scheduling uses
// the circle method so each team plays exactly once per round; the second leg
// replays every round with home and away swapped.

/** One round of pairings via the circle method (team 0 fixed, the rest rotate). */
const circleRounds = (ids: string[]): [string, string][][] => {
  const arr = ids.slice();
  const n = arr.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairings: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      pairings.push([arr[i], arr[n - 1 - i]]);
    }
    rounds.push(pairings);
    // Rotate: keep arr[0] pinned, cycle the rest one step.
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr.splice(0, arr.length, arr[0], ...rest);
  }
  return rounds;
};

/**
 * Generate the full double round-robin fixture list for the given team ids.
 * Requires an even number of teams (the campaign uses 4). Rounds are numbered
 * from 1; the second leg continues the numbering with home/away reversed.
 */
export const generateFixtures = (teamIds: string[]): Fixture[] => {
  if (teamIds.length < 2 || teamIds.length % 2 !== 0) {
    throw new Error('generateFixtures needs an even number of at least 2 teams.');
  }
  const rounds = circleRounds(teamIds);
  const fixtures: Fixture[] = [];
  let round = 1;
  const push = (home: string, away: string) =>
    fixtures.push({ round, homeId: home, awayId: away, homeScore: null, awayScore: null, played: false });

  for (const pairings of rounds) {
    for (const [home, away] of pairings) push(home, away);
    round++;
  }
  // Second leg: swap home and away in every pairing.
  for (const pairings of rounds) {
    for (const [home, away] of pairings) push(away, home);
    round++;
  }
  return fixtures;
};

// --- Standings -------------------------------------------------------------

/**
 * Build the league table from the played fixtures, on the 3-1-0 system. Rows
 * are sorted by league points, then goal difference, then points scored, then
 * team id, so the ordering is stable and deterministic. Unplayed fixtures (and
 * any referencing an unknown team) are ignored.
 */
export const computeStandings = (teamIds: string[], fixtures: Fixture[]): Standing[] => {
  const table = new Map<string, Standing>();
  for (const id of teamIds) {
    table.set(id, {
      teamId: id, played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, points: 0,
    });
  }

  for (const f of fixtures) {
    if (!f.played || f.homeScore == null || f.awayScore == null) continue;
    const home = table.get(f.homeId);
    const away = table.get(f.awayId);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.pointsFor += f.homeScore;
    home.pointsAgainst += f.awayScore;
    away.pointsFor += f.awayScore;
    away.pointsAgainst += f.homeScore;

    if (f.homeScore > f.awayScore) {
      home.won++; home.points += 3; away.lost++;
    } else if (f.homeScore < f.awayScore) {
      away.won++; away.points += 3; home.lost++;
    } else {
      home.drawn++; away.drawn++; home.points += 1; away.points += 1;
    }
  }

  return Array.from(table.values()).sort(
    (a, b) =>
      b.points - a.points ||
      (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst) ||
      b.pointsFor - a.pointsFor ||
      a.teamId.localeCompare(b.teamId)
  );
};

// --- AI-vs-AI simulator ----------------------------------------------------
//
// A non-LLM, rules-based resolver: each team drives up to `MAX_TOUCHDOWNS`
// times, scoring a drive with a probability set by its quality relative to the
// opponent's. A stronger squad scores more often, but a fixed rng always yields
// the same score, so a simulated season is fully reproducible. Scores are
// reported in touchdown points, capping naturally at the game's 21 (3 x 7).

/** Points awarded per touchdown, matching the live game. */
export const TOUCHDOWN_POINTS = 7;

/** The most touchdowns either side can score in a simulated match (3 x 7 = 21). */
export const MAX_TOUCHDOWNS = 3;

/** Count the touchdowns an `attack`-quality side scores against `defense`. */
const simulateTouchdowns = (attack: number, defense: number, rng: Rng): number => {
  const chance = attack / (attack + defense);
  let tds = 0;
  for (let drive = 0; drive < MAX_TOUCHDOWNS; drive++) {
    if (rng() < chance) tds++;
  }
  return tds;
};

/**
 * Resolve an AI-vs-AI fixture into a deterministic score derived from the two
 * teams' quality. Consumes `2 * MAX_TOUCHDOWNS` rng draws (home drives, then
 * away drives), so the same seed always produces the same result. Draws are
 * possible, feeding the 3-1-0 standings.
 */
export const simulateMatch = (home: CampaignTeam, away: CampaignTeam, rng: Rng): MatchResult => ({
  homeScore: simulateTouchdowns(home.quality, away.quality, rng) * TOUCHDOWN_POINTS,
  awayScore: simulateTouchdowns(away.quality, home.quality, rng) * TOUCHDOWN_POINTS,
});

// --- Season helpers --------------------------------------------------------

/** Create a fresh season: the given teams, a full fixture list, and the player. */
export const createCampaign = (
  teams: CampaignTeam[],
  playerTeamId: string,
  season: number = 1
): CampaignState => ({
  season,
  teams,
  fixtures: generateFixtures(teams.map((t) => t.id)),
  playerTeamId,
});

/** Record a match result onto the first unplayed matching fixture, immutably. */
export const recordResult = (
  fixtures: Fixture[],
  homeId: string,
  awayId: string,
  result: MatchResult
): Fixture[] => {
  let done = false;
  return fixtures.map((f) => {
    if (done || f.played || f.homeId !== homeId || f.awayId !== awayId) return f;
    done = true;
    return { ...f, homeScore: result.homeScore, awayScore: result.awayScore, played: true };
  });
};

/** True once every fixture in the season has been played. */
export const isSeasonComplete = (fixtures: Fixture[]): boolean =>
  fixtures.length > 0 && fixtures.every((f) => f.played);

// --- Persistence -----------------------------------------------------------
//
// A versioned localStorage envelope around the campaign, mirroring the
// save/roster systems: structural guards mean a truncated, hand-edited or
// stale-version blob degrades to "no usable campaign" rather than throwing or
// loading a half-broken season. The store is injected so this stays testable.

/** Bump when the persisted campaign shape changes; old blobs are then rejected. */
export const CAMPAIGN_VERSION = 1;

/** The single localStorage key holding the campaign. */
export const CAMPAIGN_KEY = 'spellbound_gridiron_campaign_v1';

/** The persisted envelope: a version tag wrapping the campaign state. */
export interface CampaignEnvelope {
  version: number;
  campaign: CampaignState;
}

export interface CampaignSaveResult {
  ok: boolean;
  error?: string;
}

export interface CampaignLoadResult {
  ok: boolean;
  campaign?: CampaignState;
  /** Present when `ok` is false: why the load failed (missing vs corrupt). */
  error?: string;
}

/** Serialize a campaign into the versioned JSON envelope written to storage. */
export const serializeCampaign = (campaign: CampaignState): string =>
  JSON.stringify({ version: CAMPAIGN_VERSION, campaign } as CampaignEnvelope);

const isCampaignTeam = (v: any): boolean =>
  Boolean(
    v &&
      typeof v.id === 'string' &&
      typeof v.name === 'string' &&
      typeof v.race === 'string' &&
      typeof v.color === 'string' &&
      typeof v.quality === 'number'
  );

const isFixture = (v: any): boolean =>
  Boolean(
    v &&
      typeof v.round === 'number' &&
      typeof v.homeId === 'string' &&
      typeof v.awayId === 'string' &&
      typeof v.played === 'boolean' &&
      (v.homeScore === null || typeof v.homeScore === 'number') &&
      (v.awayScore === null || typeof v.awayScore === 'number')
  );

const isCampaignState = (v: any): v is CampaignState =>
  Boolean(
    v &&
      typeof v.season === 'number' &&
      typeof v.playerTeamId === 'string' &&
      Array.isArray(v.teams) &&
      v.teams.every(isCampaignTeam) &&
      Array.isArray(v.fixtures) &&
      v.fixtures.every(isFixture)
  );

/** Parse and validate a raw campaign blob, never throwing on bad input. */
export const deserializeCampaign = (raw: string | null): CampaignLoadResult => {
  if (raw == null) {
    return { ok: false, error: 'No saved campaign found.' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Saved campaign is corrupt and could not be read.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Saved campaign is corrupt and could not be read.' };
  }
  if (parsed.version !== CAMPAIGN_VERSION) {
    return { ok: false, error: 'Saved campaign is from an incompatible version.' };
  }
  if (!isCampaignState(parsed.campaign)) {
    return { ok: false, error: 'Saved campaign is corrupt and could not be read.' };
  }

  return { ok: true, campaign: parsed.campaign };
};

/** Write the campaign to its slot. Swallows storage errors as a result. */
export const saveCampaign = (
  campaign: CampaignState,
  store: KeyValueStore | null = browserStore
): CampaignSaveResult => {
  if (!store) {
    return { ok: false, error: 'Campaigns are unavailable in this environment.' };
  }
  try {
    store.setItem(CAMPAIGN_KEY, serializeCampaign(campaign));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not write the campaign (storage full or blocked).' };
  }
};

/** Read and validate the campaign slot. Missing or corrupt data comes back `ok: false`. */
export const loadCampaign = (
  store: KeyValueStore | null = browserStore
): CampaignLoadResult => {
  if (!store) {
    return { ok: false, error: 'Campaigns are unavailable in this environment.' };
  }
  let raw: string | null;
  try {
    raw = store.getItem(CAMPAIGN_KEY);
  } catch {
    return { ok: false, error: 'Could not read the campaign slot.' };
  }
  return deserializeCampaign(raw);
};
