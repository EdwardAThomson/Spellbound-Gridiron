import {
  Position, Player, PlayerRole, PlayerStats, TeamSide, TeamData, TerrainType, Weather, MeteorWarning,
  BOARD_WIDTH, BOARD_HEIGHT,
} from '../types';
import { ROLE_STATS } from '../constants';

// Pure, deterministic game-rules logic extracted from App.tsx and gameUtils.ts.
//
// Nothing in this module reads a global clock or a global RNG: every function
// that needs randomness takes an `Rng` argument. That makes the rules unit
// testable with a seeded/fake source and keeps the "roll" separate from the
// "resolve". `gameUtils.ts` binds these to the real runtime rng.

/** A source of randomness returning a float in [0, 1), as the runtime rng does. */
export type Rng = () => number;

/** Roll a single die with `sides` faces using the injected rng. */
export const rollDie = (rng: Rng, sides: number = 6): number =>
  Math.floor(rng() * sides) + 1;

/** True when `pos` lies on the board. */
export const isPositionValid = (pos: Position): boolean =>
  pos.x >= 0 && pos.x < BOARD_WIDTH && pos.y >= 0 && pos.y < BOARD_HEIGHT;

/** Manhattan (grid) distance between two positions. */
export const manhattanDistance = (a: Position, b: Position): number =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Adjacency including diagonals (a king's move), excluding the tile itself. */
export const isAdjacent = (a: Position, b: Position): boolean => {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx <= 1 && dy <= 1 && dx + dy > 0;
};

/** The player occupying `pos`, if any. */
export const getPlayerAtPosition = (
  pos: Position,
  players: Player[]
): Player | undefined =>
  players.find((p) => p.position.x === pos.x && p.position.y === pos.y);

export interface TackleResult {
  success: boolean;
  attackRoll: number;
  defendRoll: number;
  log: string;
}

/** STR + d6 vs STR + d6; attacker wins on a strictly higher total. */
export const resolveTackle = (
  attacker: Player,
  defender: Player,
  rng: Rng
): TackleResult => {
  const attackRoll = rollDie(rng, 6) + attacker.stats.strength;
  const defendRoll = rollDie(rng, 6) + defender.stats.strength;
  const success = attackRoll > defendRoll;
  return {
    success,
    attackRoll,
    defendRoll,
    log: success
      ? `${attacker.name} smashed ${defender.name} (Roll: ${attackRoll} vs ${defendRoll})!`
      : `${attacker.name} bounced off ${defender.name} (Roll: ${attackRoll} vs ${defendRoll})!`,
  };
};

export interface PassResult {
  success: boolean;
  roll: number;
  difficulty: number;
  log: string;
}

/**
 * SKL + d6 vs `2 + manhattan_distance + weatherMod`; success on roll >= difficulty.
 * The difficulty metric is Manhattan (grid) distance to match the rulebook
 * (`GAME_RULES` in utils/contextSerializer.ts) and CLAUDE.md. Bad weather
 * (`weatherMod`, from `weatherPassModifier`) raises the difficulty on top of it.
 */
export const resolvePass = (
  thrower: Player,
  targetPos: Position,
  rng: Rng,
  weatherMod: number = 0
): PassResult => {
  const difficulty = 2 + manhattanDistance(thrower.position, targetPos) + weatherMod;
  const roll = rollDie(rng, 6) + thrower.stats.skill;
  const success = roll >= difficulty;
  return {
    success,
    roll,
    difficulty,
    log: success
      ? `${thrower.name} throws a perfect spiral! (Roll: ${roll} vs DC: ${difficulty})`
      : `${thrower.name} fumbles the pass! (Roll: ${roll} vs DC: ${difficulty})`,
  };
};

/**
 * Scatter a loose ball one square diagonally from `pos`, clamped inside the
 * playable field (excluding the outer border rows/columns). Consumes two rng
 * draws (x then y).
 */
export const scatterPosition = (pos: Position, rng: Rng): Position => {
  const scatterX = pos.x + (rng() > 0.5 ? 1 : -1);
  const scatterY = pos.y + (rng() > 0.5 ? 1 : -1);
  return {
    x: Math.max(1, Math.min(BOARD_WIDTH - 2, scatterX)),
    y: Math.max(1, Math.min(BOARD_HEIGHT - 2, scatterY)),
  };
};

// --- Pathfinding -----------------------------------------------------------
//
// Movement is a king's move (8 directions), one Move point per square. The
// board is small (12x18), so a plain BFS gives shortest paths cheaply. Blocked
// tiles (any player) can be neither passed through nor landed on; the loose
// ball's tile is an ordinary walkable square.

const KING_STEPS: readonly { x: number; y: number }[] = [
  { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  { x: -1, y: 0 },                    { x: 1, y: 0 },
  { x: -1, y: 1 },  { x: 0, y: 1 },  { x: 1, y: 1 },
];

const posKey = (p: Position): string => `${p.x},${p.y}`;

/** BFS from `from` up to `maxSteps`, returning each visited tile's parent. */
const bfsParents = (
  from: Position,
  maxSteps: number,
  isBlocked: (pos: Position) => boolean
): Map<string, { pos: Position; parent: string | null; depth: number }> => {
  const visited = new Map<string, { pos: Position; parent: string | null; depth: number }>();
  visited.set(posKey(from), { pos: from, parent: null, depth: 0 });
  let frontier: Position[] = [from];
  for (let depth = 1; depth <= maxSteps && frontier.length > 0; depth++) {
    const next: Position[] = [];
    for (const tile of frontier) {
      for (const step of KING_STEPS) {
        const neighbour = { x: tile.x + step.x, y: tile.y + step.y };
        const key = posKey(neighbour);
        if (visited.has(key) || !isPositionValid(neighbour) || isBlocked(neighbour)) continue;
        visited.set(key, { pos: neighbour, parent: posKey(tile), depth });
        next.push(neighbour);
      }
    }
    frontier = next;
  }
  return visited;
};

/**
 * Shortest walkable path from `from` to `to` within `maxSteps` Move points,
 * as the sequence of tiles to step onto (excluding `from`). Returns null when
 * `to` is blocked, off-board, or out of range.
 */
export const findPath = (
  from: Position,
  to: Position,
  maxSteps: number,
  isBlocked: (pos: Position) => boolean
): Position[] | null => {
  if (!isPositionValid(to) || isBlocked(to)) return null;
  if (from.x === to.x && from.y === to.y) return null;
  const visited = bfsParents(from, maxSteps, isBlocked);
  const goal = visited.get(posKey(to));
  if (!goal) return null;
  const path: Position[] = [];
  for (let node = goal; node.parent !== null; node = visited.get(node.parent)!) {
    path.unshift(node.pos);
  }
  return path;
};

/** Every tile reachable from `from` within `maxSteps` (excluding `from`). */
export const reachableTiles = (
  from: Position,
  maxSteps: number,
  isBlocked: (pos: Position) => boolean
): Position[] =>
  Array.from(bfsParents(from, maxSteps, isBlocked).values())
    .filter((node) => node.depth > 0)
    .map((node) => node.pos);

// --- Kickoff formation -----------------------------------------------------
//
// Deterministic formation slots, shared by initial setup and every kickoff
// reset (post-touchdown and rematch). Index is the player's position in its
// team array; Linemen stand two rows ahead of their line as a vanguard.

export const FORMATION_X = [2, 4, 6, 8, 10];

export const kickoffPosition = (
  side: TeamSide,
  index: number,
  role: PlayerRole
): Position => {
  const home = side === TeamSide.HOME;
  const startY = home ? 1 : BOARD_HEIGHT - 2;
  const stagger = role === PlayerRole.LINEMAN ? (home ? 2 : -2) : 0;
  return { x: FORMATION_X[index % FORMATION_X.length], y: startY + stagger };
};

// --- Win condition ---------------------------------------------------------
//
// The game ends when either team reaches `WIN_SCORE` points (3 touchdowns at
// 7 points each), or once `MAX_TURNS` full turns have elapsed, whichever comes
// first. The winner is the higher score at that point; an equal score is a draw
// (isGameOver true, winner null). Kept pure so App can wire it into both the
// touchdown path and end-of-turn without duplicating the thresholds.

export const WIN_SCORE = 21;
export const MAX_TURNS = 16;

export interface GameOutcome {
  isGameOver: boolean;
  winner: TeamSide | null;
}

export const checkWinner = (
  homeScore: number,
  awayScore: number,
  turn: number,
  winScore: number = WIN_SCORE,
  maxTurns: number = MAX_TURNS
): GameOutcome => {
  const reachedCap = homeScore >= winScore || awayScore >= winScore;
  const outOfTurns = turn > maxTurns;
  if (!reachedCap && !outOfTurns) {
    return { isGameOver: false, winner: null };
  }
  let winner: TeamSide | null = null;
  if (homeScore > awayScore) winner = TeamSide.HOME;
  else if (awayScore > homeScore) winner = TeamSide.AWAY;
  return { isGameOver: true, winner };
};

// --- Spell targeting -------------------------------------------------------
//
// Enforces range and target validity for the three spells so the code matches
// what SPELLS advertises and what the LLM tells players. Range is measured as
// Manhattan distance from the caster's tile.
//
// - Fireball (range 4): must strike an enemy player. Cannot hit an ally or an
//   empty tile.
// - Blink    (range 5): must land on an empty, on-board tile. Cannot land on an
//   occupied square.
// - Revitalize (range 1): must target a stunned ally. Cannot clear an enemy's
//   stun or "heal" someone who is not stunned.

export interface SpellValidation {
  valid: boolean;
  reason: string;
}

export const validateSpellCast = (
  spellKey: string,
  caster: Player,
  targetPos: Position,
  targetPlayer: Player | undefined,
  range: number
): SpellValidation => {
  const dist = manhattanDistance(caster.position, targetPos);
  if (dist > range) {
    return { valid: false, reason: `Target out of range (${dist} > ${range}).` };
  }

  switch (spellKey) {
    case 'FIREBALL': // Fireball
      if (!targetPlayer) return { valid: false, reason: 'Fireball needs an enemy target.' };
      if (targetPlayer.team === caster.team) return { valid: false, reason: 'Fireball cannot target an ally.' };
      return { valid: true, reason: '' };
    case 'TELEPORT': // Blink
      if (!isPositionValid(targetPos)) return { valid: false, reason: 'Blink target is off the board.' };
      if (targetPlayer) return { valid: false, reason: 'Blink must target an empty square.' };
      return { valid: true, reason: '' };
    case 'HEAL': // Revitalize
      if (!targetPlayer) return { valid: false, reason: 'Revitalize needs an ally target.' };
      if (targetPlayer.team !== caster.team) return { valid: false, reason: 'Revitalize can only aid allies.' };
      if (!targetPlayer.isStunned) return { valid: false, reason: 'That ally is not stunned.' };
      return { valid: true, reason: '' };
    default:
      return { valid: true, reason: '' };
  }
};

// --- Terrain & weather -----------------------------------------------------
//
// Terrain and weather turn the four cosmetic pitch/sky types into real
// mechanics. Everything here is pure and rng-injected so it stays testable:
//
// - Mud   (Orc Pits):    a completed step has a chance to slip, dropping the
//                        mover prone (stunned) where they land.
// - Lava  (Demon Forge): a fixed set of seeded hazard tiles knock down anyone
//                        who steps onto them.
// - Ice   (Frozen Wastes): a step slides one extra tile in the travel direction
//                        when that tile is open.
// - Rain / Blizzard:     raise pass difficulty (`weatherPassModifier`).
//                        Blizzard also costs every player 1 Move point per turn
//                        (`weatherMovePenalty` / `effectiveMove`).
// - Meteor Shower:       a meteor is telegraphed one round, then strikes its
//                        tile, knocking down whoever stands there.

/** Probability that a single step on Mud terrain ends in a slip (knockdown). */
export const MUD_SLIP_CHANCE = 0.25;

/** Number of seeded hazard tiles placed on a Lava pitch. */
export const LAVA_HAZARD_COUNT = 6;

/** Extra pass difficulty from the current weather (Rain +1, Blizzard +2). */
export const weatherPassModifier = (weather: Weather): number => {
  switch (weather) {
    case Weather.RAIN:
      return 1;
    case Weather.BLIZZARD:
      return 2;
    default:
      return 0;
  }
};

/**
 * Move-point penalty every player suffers from the current weather. Only a
 * Blizzard bites here: driving snow costs every player 1 Move point per turn,
 * on top of the +2 pass difficulty from `weatherPassModifier`. Returned as a
 * positive magnitude to subtract from a unit's base Move.
 */
export const weatherMovePenalty = (weather: Weather): number =>
  weather === Weather.BLIZZARD ? 1 : 0;

/**
 * A player's effective Move for the turn given the weather. The Blizzard
 * penalty never drops a unit below 1, so a snowed-in player can still shuffle a
 * single square.
 */
export const effectiveMove = (baseMove: number, weather: Weather): number =>
  Math.max(1, baseMove - weatherMovePenalty(weather));

/** True when `pos` is one of the seeded lava hazard tiles. */
export const isHazard = (pos: Position, hazards: Position[]): boolean =>
  hazards.some((h) => h.x === pos.x && h.y === pos.y);

/**
 * Pick `count` distinct interior tiles (off the endzone rows) as lava hazards,
 * deterministically from the injected rng. A bounded guard stops the loop even
 * if the rng keeps colliding.
 */
export const generateLavaHazards = (count: number, rng: Rng): Position[] => {
  const hazards: Position[] = [];
  let guard = 0;
  while (hazards.length < count && guard < count * 40) {
    guard++;
    const x = 1 + Math.floor(rng() * (BOARD_WIDTH - 2));
    const y = 2 + Math.floor(rng() * (BOARD_HEIGHT - 4));
    if (!hazards.some((p) => p.x === x && p.y === y)) hazards.push({ x, y });
  }
  return hazards;
};

export interface StepEffect {
  /** Where the mover ends up (ice can carry them one tile further). */
  position: Position;
  /** True when the mover is knocked down (stunned) on arrival. */
  knockedDown: boolean;
  /** A player-facing line describing what happened, or null for a plain step. */
  log: string | null;
}

/**
 * Resolve the terrain side-effect of a single completed step from `from` to
 * `to`. Grass is a no-op. Only Mud consumes the rng (its slip roll); ice slide
 * and lava hazards are deterministic given their inputs. `isBlocked` reports
 * whether a prospective slide tile is occupied, so ice never slides onto a unit.
 */
export const resolveTerrainStep = (
  terrain: TerrainType,
  from: Position,
  to: Position,
  hazards: Position[],
  isBlocked: (pos: Position) => boolean,
  rng: Rng
): StepEffect => {
  if (terrain === TerrainType.LAVA && isHazard(to, hazards)) {
    return {
      position: to,
      knockedDown: true,
      log: `The molten ground erupts at (${to.x}, ${to.y}) - knocked down on a lava hazard!`,
    };
  }

  if (terrain === TerrainType.MUD && rng() < MUD_SLIP_CHANCE) {
    return { position: to, knockedDown: true, log: 'Lost their footing in the mud and slipped!' };
  }

  if (terrain === TerrainType.ICE) {
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    const slide = { x: to.x + dx, y: to.y + dy };
    if ((dx !== 0 || dy !== 0) && isPositionValid(slide) && !isBlocked(slide)) {
      return { position: slide, knockedDown: false, log: `Slid across the ice to (${slide.x}, ${slide.y}).` };
    }
  }

  return { position: to, knockedDown: false, log: null };
};

export interface MeteorResolution {
  /** The tile struck by the meteor telegraphed last round, or null if none. */
  strike: Position | null;
  /** The freshly telegraphed meteor for the upcoming turn. */
  next: MeteorWarning;
}

// --- XP & progression ------------------------------------------------------
//
// Players earn XP from the plays they make and level up into small, role-capped
// stat bumps. Everything here is pure and rng-injected: `awardXp` folds an XP
// gain into a player, applying one stat bump per level crossed, so the same seed
// always grows a player the same way. `gameUtils.ts` binds the real rng and
// `App` calls it after a successful tackle/pass/spell/touchdown.

/** XP granted for each kind of play. Documented here and in GAME_RULES. */
export const XP_AWARDS = {
  /** Landing a successful tackle. */
  TACKLE: 2,
  /** Completing a pass (caught by a team-mate or landing cleanly). */
  PASS: 2,
  /** Casting any spell successfully. */
  SPELL: 1,
  /** Carrying the ball into the endzone. */
  TOUCHDOWN: 5,
} as const;

/**
 * Cumulative XP needed to reach each level (index i => level i + 1). A player
 * starts at level 1 with 0 XP; the final threshold is the effective cap.
 */
export const LEVEL_THRESHOLDS = [0, 5, 12, 21, 32];

/** The highest level reachable (the number of thresholds). */
export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

/** The (1-based) level a given cumulative XP total corresponds to. */
export const levelForXp = (xp: number): number => {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
};

/**
 * Which stats each role raises on level-up, in preference order. A level bump
 * picks (via the injected rng) among the role's growth stats that have not yet
 * hit their bump cap, so growth stays flavourful but bounded to the role.
 */
export const ROLE_GROWTH: Record<PlayerRole, (keyof PlayerStats)[]> = {
  [PlayerRole.LINEMAN]: ['strength', 'armor'],
  [PlayerRole.BLITZER]: ['strength', 'move'],
  [PlayerRole.CATCHER]: ['skill', 'move'],
  [PlayerRole.QUARTERBACK]: ['skill', 'strength'],
  [PlayerRole.WIZARD]: ['skill', 'strength'],
};

/** The most any single stat can rise above its role's base from level bumps. */
export const MAX_STAT_BUMP = 3;

export interface LevelBump {
  stats: PlayerStats;
  bumped: keyof PlayerStats | null;
}

/**
 * Apply one level-up stat bump to `stats`, capped so no stat rises more than
 * `MAX_STAT_BUMP` above the role's base (`ROLE_STATS`). Returns the (possibly
 * unchanged) stats and which stat was raised, or `bumped: null` when every
 * growth stat is already capped. Consumes one rng draw to pick among the
 * eligible stats.
 */
export const applyLevelBump = (
  role: PlayerRole,
  stats: PlayerStats,
  rng: Rng
): LevelBump => {
  const base = ROLE_STATS[role];
  const eligible = ROLE_GROWTH[role].filter((s) => stats[s] - base[s] < MAX_STAT_BUMP);
  if (eligible.length === 0) return { stats, bumped: null };
  const pick = eligible[Math.floor(rng() * eligible.length)];
  return { stats: { ...stats, [pick]: stats[pick] + 1 }, bumped: pick };
};

export interface XpAward {
  /** The player with the XP, level and any stat bumps folded in. */
  player: Player;
  /** True when the award pushed the player up at least one level. */
  leveledUp: boolean;
  /** The stats raised by this award (one per level crossed). */
  bumped: (keyof PlayerStats)[];
  /** A player-facing line on a level-up, or null when nothing noteworthy. */
  log: string | null;
}

/**
 * Fold an XP gain into a player: add the XP, recompute the level, and apply one
 * role-capped stat bump for every level crossed. Pure and rng-injected (each
 * level bump consumes one rng draw). A zero or negative award only records the
 * (unchanged) XP total and never levels down.
 */
export const awardXp = (player: Player, amount: number, rng: Rng): XpAward => {
  const startLevel = levelForXp(player.xp);
  const xp = player.xp + Math.max(0, amount);
  const newLevel = levelForXp(xp);

  let stats = player.stats;
  const bumped: (keyof PlayerStats)[] = [];
  for (let lvl = startLevel; lvl < newLevel; lvl++) {
    const res = applyLevelBump(player.role, stats, rng);
    stats = res.stats;
    if (res.bumped) bumped.push(res.bumped);
  }

  const leveledUp = newLevel > startLevel;
  const log = leveledUp
    ? `${player.name} reaches Level ${newLevel}!${bumped.length ? ` (${bumped.join(', ')} up)` : ''}`
    : null;

  return {
    player: { ...player, xp, level: newLevel, stats },
    leveledUp,
    bumped,
    log,
  };
};

/** Choose an interior impact tile for a meteor that will land on `strikeTurn`. */
export const chooseMeteorTarget = (strikeTurn: number, rng: Rng): MeteorWarning => ({
  target: {
    x: 1 + Math.floor(rng() * (BOARD_WIDTH - 2)),
    y: 1 + Math.floor(rng() * (BOARD_HEIGHT - 2)),
  },
  strikeTurn,
});

/**
 * Advance the meteor telegraph by one turn: the currently telegraphed meteor
 * (if any) lands now, and a fresh one is telegraphed for `upcomingTurn`. This is
 * the one-round warning - a meteor is always visible for a full round before it
 * strikes.
 */
export const advanceMeteor = (
  current: MeteorWarning | null,
  upcomingTurn: number,
  rng: Rng
): MeteorResolution => ({
  strike: current ? current.target : null,
  next: chooseMeteorTarget(upcomingTurn, rng),
});

// --- Persistent rosters ----------------------------------------------------
//
// A roster is a team's *durable* progression, distilled out of a live
// `TeamData` so it can outlive a single match. It keeps only what should carry
// forward - the team's identity plus each player's earned XP, level and
// (bumped) stats - and drops everything that is match-specific (board position,
// ball possession, stun, moves remaining, selection). A rematch rebuilds fresh
// players at their formation slots and then overlays the roster back on top, so
// veterans return with the XP and stat bumps they earned last time.
//
// These functions are pure (no storage, no rng); `services/roster.ts` wraps
// them in a versioned localStorage slot, mirroring the save/load system.

/** Bump when the persisted roster shape changes; old roster blobs are rejected. */
export const ROSTER_VERSION = 1;

/** One player's durable progression within a roster slot. */
export interface RosterPlayer {
  id: string;
  name: string;
  role: PlayerRole;
  xp: number;
  level: number;
  stats: PlayerStats;
}

/** A named team slot: its identity plus every player's carried progression. */
export interface Roster {
  name: string;
  race: string;
  color: string;
  players: RosterPlayer[];
}

/** Distil a live team down to the roster progression that carries across matches. */
export const extractRoster = (team: TeamData): Roster => ({
  name: team.name,
  race: team.race,
  color: team.color,
  players: team.players.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    xp: p.xp,
    level: p.level,
    stats: { ...p.stats },
  })),
});

const isRosterPlayer = (v: any): v is RosterPlayer =>
  Boolean(
    v &&
      typeof v.id === 'string' &&
      typeof v.name === 'string' &&
      Object.values(PlayerRole).includes(v.role) &&
      typeof v.xp === 'number' &&
      typeof v.level === 'number' &&
      v.stats &&
      typeof v.stats.move === 'number' &&
      typeof v.stats.strength === 'number' &&
      typeof v.stats.skill === 'number' &&
      typeof v.stats.armor === 'number'
  );

/** Structural guard so a corrupt/hand-edited roster degrades to "no roster". */
export const isRoster = (v: any): v is Roster =>
  Boolean(
    v &&
      typeof v.name === 'string' &&
      typeof v.race === 'string' &&
      typeof v.color === 'string' &&
      Array.isArray(v.players) &&
      v.players.every(isRosterPlayer)
  );

/**
 * Overlay a roster's carried progression onto a set of freshly-created match
 * players, matched by player id. Fresh, match-specific fields (position, mana,
 * moves, stun, ball) are kept; name, XP, level and stats are restored from the
 * roster. A fresh player with no matching roster entry is returned unchanged, so
 * a partial or reshaped roster still yields a fully playable team.
 */
export const applyRoster = (roster: Roster, freshPlayers: Player[]): Player[] =>
  freshPlayers.map((p) => {
    const saved = roster.players.find((r) => r.id === p.id);
    if (!saved) return p;
    return {
      ...p,
      name: saved.name,
      xp: saved.xp,
      level: saved.level,
      stats: { ...saved.stats },
    };
  });
