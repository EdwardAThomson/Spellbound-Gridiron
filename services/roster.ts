import { Roster, isRoster, ROSTER_VERSION } from './rules';
import { KeyValueStore, browserStore } from './saveGame';

// Persistent, named-slot rosters that carry teams (players with their earned
// XP, levels and stat bumps) across matches. This lives alongside, and is
// independent of, the single-match save system in `saveGame.ts`: the save slot
// snapshots one in-progress match, whereas the roster slots persist only the
// two teams' progression so a post-game rematch can field the same veterans.
//
// The pure roster shaping/validation lives in `rules.ts`; this module is just
// the versioned localStorage envelope around it, mirroring the save/load guards.
// The store is injected (defaulting to the browser's localStorage) so the logic
// stays unit-testable in a node environment with no Web Storage API.

/** The single localStorage key holding the roster slots. */
export const ROSTER_KEY = 'spellbound_gridiron_rosters_v1';

/** The two named team slots persisted between matches. */
export interface RosterSlots {
  home: Roster;
  away: Roster;
}

/** The persisted envelope: a version tag wrapping the named roster slots. */
export interface RosterEnvelope {
  version: number;
  slots: RosterSlots;
}

export interface RosterSaveResult {
  ok: boolean;
  error?: string;
}

export interface RosterLoadResult {
  ok: boolean;
  slots?: RosterSlots;
  /** Present when `ok` is false: why the load failed (missing vs corrupt). */
  error?: string;
}

/** Serialize the roster slots into the versioned JSON envelope. */
export const serializeRosters = (slots: RosterSlots): string =>
  JSON.stringify({ version: ROSTER_VERSION, slots } as RosterEnvelope);

/** Parse and validate a raw roster blob, never throwing on bad input. */
export const deserializeRosters = (raw: string | null): RosterLoadResult => {
  if (raw == null) {
    return { ok: false, error: 'No saved rosters found.' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Saved rosters are corrupt and could not be read.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Saved rosters are corrupt and could not be read.' };
  }
  if (parsed.version !== ROSTER_VERSION) {
    return { ok: false, error: 'Saved rosters are from an incompatible version.' };
  }
  if (!parsed.slots || !isRoster(parsed.slots.home) || !isRoster(parsed.slots.away)) {
    return { ok: false, error: 'Saved rosters are corrupt and could not be read.' };
  }

  return { ok: true, slots: { home: parsed.slots.home, away: parsed.slots.away } };
};

/** Write both team rosters to the slot. Swallows storage errors as a result. */
export const saveRosters = (
  slots: RosterSlots,
  store: KeyValueStore | null = browserStore
): RosterSaveResult => {
  if (!store) {
    return { ok: false, error: 'Rosters are unavailable in this environment.' };
  }
  try {
    store.setItem(ROSTER_KEY, serializeRosters(slots));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not write the rosters (storage full or blocked).' };
  }
};

/** Read and validate the roster slot. Missing or corrupt data comes back `ok: false`. */
export const loadRosters = (
  store: KeyValueStore | null = browserStore
): RosterLoadResult => {
  if (!store) {
    return { ok: false, error: 'Rosters are unavailable in this environment.' };
  }
  let raw: string | null;
  try {
    raw = store.getItem(ROSTER_KEY);
  } catch {
    return { ok: false, error: 'Could not read the roster slot.' };
  }
  return deserializeRosters(raw);
};
