import { Player, PlayerRole, Position, RaceId, SkillId, TerrainType, Weather } from '../types';

// Skills: the catalog, who can learn what, and the small pure modifiers each
// skill feeds into the rules. Nothing here rolls dice or reads globals; the
// resolvers in `rules.ts` call these helpers and stay rng-injected.
//
// A player learns at most MAX_SKILLS skills, one at each level in SKILL_LEVELS,
// freely chosen from their pool: their role's skills plus their race's skills.
// Once-per-match skills are tracked in `Player.spentSkills`, reset at kickoff.
//
// This module deliberately does not import `rules.ts` (rules imports it), so
// the few geometry helpers it needs are local.

export interface SkillDef {
  id: SkillId;
  name: string;
  description: string;
  /** Exactly one of role / race is set: whose pool the skill is in. */
  role?: PlayerRole;
  race?: RaceId;
  /** True when the skill can only fire once per match. */
  oncePerMatch?: boolean;
}

const role = (r: PlayerRole) => ({ role: r });
const race = (r: RaceId) => ({ race: r });

export const SKILLS: Record<SkillId, SkillDef> = {
  // Lineman
  stonewall: { id: 'stonewall', name: 'Stonewall', description: '+1 STR when defending a tackle.', ...role(PlayerRole.LINEMAN) },
  rune_guard: { id: 'rune_guard', name: 'Rune-Guard', description: 'The first Fireball aimed at you each match fizzles.', ...role(PlayerRole.LINEMAN), oncePerMatch: true },
  bodyguard: { id: 'bodyguard', name: 'Bodyguard', description: 'Allies next to you get +1 STR when defending a tackle.', ...role(PlayerRole.LINEMAN) },
  // Blitzer
  juggernaut: { id: 'juggernaut', name: 'Juggernaut', description: '+1 STR when tackling after moving 3+ squares this turn.', ...role(PlayerRole.BLITZER) },
  charge: { id: 'charge', name: 'Charge', description: '+1 Move on turns you start without the ball.', ...role(PlayerRole.BLITZER) },
  frenzy: { id: 'frenzy', name: 'Frenzy', description: 'Once per match, a tackle does not end your action: keep your remaining Move (less 1) and go again.', ...role(PlayerRole.BLITZER), oncePerMatch: true },
  // Catcher
  slippery: { id: 'slippery', name: 'Slippery', description: 'Once per match, a tackle that would down you fails instead.', ...role(PlayerRole.CATCHER), oncePerMatch: true },
  sure_hands: { id: 'sure_hands', name: 'Sure Hands', description: 'Passes thrown to you are 1 easier.', ...role(PlayerRole.CATCHER) },
  sprint: { id: 'sprint', name: 'Sprint', description: 'Once per match, +2 Move for one turn.', ...role(PlayerRole.CATCHER), oncePerMatch: true },
  // Quarterback
  strong_arm: { id: 'strong_arm', name: 'Strong Arm', description: 'Passes of 5+ squares are 1 easier.', ...role(PlayerRole.QUARTERBACK) },
  storm_thrower: { id: 'storm_thrower', name: 'Storm-Thrower', description: 'The weather pass penalty is 1 lower (Rain 0, Blizzard +1).', ...role(PlayerRole.QUARTERBACK) },
  quick_release: { id: 'quick_release', name: 'Quick Release', description: 'Passing does not end your action: keep your remaining Move.', ...role(PlayerRole.QUARTERBACK) },
  // Wizard
  deep_well: { id: 'deep_well', name: 'Deep Well', description: '+1 starting mana.', ...role(PlayerRole.WIZARD) },
  far_caster: { id: 'far_caster', name: 'Far-Caster', description: '+1 range on Fireball and Blink.', ...role(PlayerRole.WIZARD) },
  hex: { id: 'hex', name: 'Hex', description: 'A Fireball target also loses 1 Move on its next turn, even if its armor holds.', ...role(PlayerRole.WIZARD) },
  mana_spark: { id: 'mana_spark', name: 'Mana Spark', description: '+1 mana each time your team scores (up to starting mana + 1).', ...role(PlayerRole.WIZARD) },
  // High Elves
  fleet: { id: 'fleet', name: 'Fleet', description: '+1 Move.', ...race('elves') },
  starlit_aim: { id: 'starlit_aim', name: 'Starlit Aim', description: 'Passes are 1 easier in Clear weather.', ...race('elves') },
  leap: { id: 'leap', name: 'Leap', description: 'Once per match, your move may pass over one occupied square.', ...race('elves'), oncePerMatch: true },
  // Dark Orcs
  brutal: { id: 'brutal', name: 'Brutal', description: '+1 STR when making a tackle.', ...race('orcs') },
  mudborn: { id: 'mudborn', name: 'Mudborn', description: 'Never slips in Mud.', ...race('orcs') },
  strip: { id: 'strip', name: 'Strip', description: 'A tackle that fails still knocks the ball loose from the carrier.', ...race('orcs') },
  // Dwarves
  shoulder: { id: 'shoulder', name: 'Shoulder to Shoulder', description: '+1 STR defending a tackle while an ally is next to you.', ...race('dwarves') },
  forge_born: { id: 'forge_born', name: 'Forge-born', description: 'Immune to Lava hazards.', ...race('dwarves') },
  iron_hide: { id: 'iron_hide', name: 'Iron Hide', description: '+1 on armor saves.', ...race('dwarves') },
  // Undead
  unliving: { id: 'unliving', name: 'Unliving', description: 'The first knockdown each match does not stun you.', ...race('undead'), oncePerMatch: true },
  grave_chill: { id: 'grave_chill', name: 'Grave Chill', description: 'Enemies throwing from next to you are +1 difficulty.', ...race('undead') },
  ice_skater: { id: 'ice_skater', name: 'Ice Skater', description: 'Never slides on Ice.', ...race('undead') },
  // Humans
  rally: { id: 'rally', name: 'Rally', description: '+1 STR when tackling with two or more allies next to you.', ...race('humans') },
  drilled: { id: 'drilled', name: 'Drilled', description: 'Once per match, a failed pass aimed at you is caught anyway.', ...race('humans'), oncePerMatch: true },
  ball_clamp: { id: 'ball_clamp', name: 'Ball Clamp', description: 'You keep the ball when knocked down.', ...race('humans') },
};

export const ALL_SKILL_IDS = Object.keys(SKILLS) as SkillId[];

export const isSkillId = (v: unknown): v is SkillId =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(SKILLS, v);

/** The most skills one player can know. */
export const MAX_SKILLS = 2;

/** The levels that grant a skill pick (one each). */
export const SKILL_LEVELS = [3, 5];

/**
 * Map a team's display race to its id, or null for a race with no skill pool
 * (then only role skills are on offer).
 */
export const raceIdFromName = (name: string): RaceId | null => {
  const n = name.toLowerCase();
  if (n.includes('elf') || n.includes('elv')) return 'elves';
  if (n.includes('orc')) return 'orcs';
  if (n.includes('dwar')) return 'dwarves';
  if (n.includes('undead')) return 'undead';
  if (n.includes('human')) return 'humans';
  return null;
};

/** Every skill a player of `role` and `raceId` may learn: role skills, then race skills. */
export const skillPool = (playerRole: PlayerRole, raceId: RaceId | null): SkillId[] =>
  ALL_SKILL_IDS.filter((id) => SKILLS[id].role === playerRole || (raceId !== null && SKILLS[id].race === raceId));

// Players from older saves/rosters may lack the arrays, so read defensively.
const skillsOf = (p: Player): SkillId[] => p.skills ?? [];
const spentOf = (p: Player): SkillId[] => p.spentSkills ?? [];

export const hasSkill = (p: Player, id: SkillId): boolean => skillsOf(p).includes(id);

/** True when the player has the skill and, if once-per-match, has not used it yet. */
export const canUseSkill = (p: Player, id: SkillId): boolean =>
  hasSkill(p, id) && !(SKILLS[id].oncePerMatch && spentOf(p).includes(id));

/** Mark a once-per-match skill as used this match. */
export const spendSkill = (p: Player, id: SkillId): Player =>
  spentOf(p).includes(id) ? p : { ...p, spentSkills: [...spentOf(p), id] };

/**
 * How many skill picks the player is owed: one per SKILL_LEVELS level reached,
 * less the skills already learned. Derived, so a pick can never be lost by
 * quitting before choosing.
 */
export const skillPicksOwed = (p: Player): number => {
  const earned = SKILL_LEVELS.filter((lvl) => p.level >= lvl).length;
  return Math.max(0, Math.min(MAX_SKILLS, earned) - skillsOf(p).length);
};

export type LearnResult = { ok: true; player: Player } | { ok: false; error: string };

/** Learn `id` if it is in the player's pool, not already known, and a pick is owed. */
export const learnSkill = (p: Player, raceId: RaceId | null, id: SkillId): LearnResult => {
  if (!skillPool(p.role, raceId).includes(id)) return { ok: false, error: `${SKILLS[id].name} is not in ${p.name}'s pool.` };
  if (hasSkill(p, id)) return { ok: false, error: `${p.name} already knows ${SKILLS[id].name}.` };
  if (skillPicksOwed(p) <= 0) return { ok: false, error: `${p.name} has no skill pick available.` };
  return { ok: true, player: { ...p, skills: [...skillsOf(p), id] } };
};

/**
 * The computer's pick: a fixed per-role preference order, then the race pool
 * in catalog order, skipping skills already known. Deterministic, so a
 * simulated season replays identically.
 */
export const AUTO_PICK_ORDER: Record<PlayerRole, SkillId[]> = {
  [PlayerRole.LINEMAN]: ['stonewall', 'bodyguard', 'rune_guard'],
  [PlayerRole.BLITZER]: ['juggernaut', 'frenzy', 'charge'],
  [PlayerRole.CATCHER]: ['sure_hands', 'slippery', 'sprint'],
  [PlayerRole.QUARTERBACK]: ['strong_arm', 'quick_release', 'storm_thrower'],
  [PlayerRole.WIZARD]: ['deep_well', 'far_caster', 'hex', 'mana_spark'],
};

export const autoPickSkill = (p: Player, raceId: RaceId | null): SkillId | null => {
  if (skillPicksOwed(p) <= 0) return null;
  const pool = skillPool(p.role, raceId);
  const order = [...AUTO_PICK_ORDER[p.role], ...pool.filter((id) => SKILLS[id].race)];
  return order.find((id) => pool.includes(id) && !hasSkill(p, id)) ?? null;
};

// --- Rule modifiers ----------------------------------------------------------

const adjacent = (a: Position, b: Position): boolean => {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
};

const standingNeighbours = (p: Player, players: Player[], sameTeam: boolean): Player[] =>
  players.filter(
    (o) => o.id !== p.id && !o.isStunned && (o.team === p.team) === sameTeam && adjacent(o.position, p.position)
  );

export interface TackleModifiers {
  /** Added to the attacker's STR + d6. */
  atk: number;
  /** Added to the defender's STR + d6. */
  def: number;
  /** Names of the skills that applied, for the log. */
  notes: string[];
}

/** Skill bonuses to a tackle, given every player on the pitch. */
export const tackleModifiers = (attacker: Player, defender: Player, players: Player[]): TackleModifiers => {
  let atk = 0;
  let def = 0;
  const notes: string[] = [];
  if (hasSkill(attacker, 'brutal')) { atk++; notes.push(SKILLS.brutal.name); }
  if (hasSkill(attacker, 'juggernaut') && (attacker.movedThisTurn ?? 0) >= 3) { atk++; notes.push(SKILLS.juggernaut.name); }
  if (hasSkill(attacker, 'rally') && standingNeighbours(attacker, players, true).length >= 2) { atk++; notes.push(SKILLS.rally.name); }

  const defAllies = standingNeighbours(defender, players, true);
  if (hasSkill(defender, 'stonewall')) { def++; notes.push(SKILLS.stonewall.name); }
  if (hasSkill(defender, 'shoulder') && defAllies.length >= 1) { def++; notes.push(SKILLS.shoulder.name); }
  if (defAllies.some((a) => hasSkill(a, 'bodyguard'))) { def++; notes.push(SKILLS.bodyguard.name); }
  return { atk, def, notes };
};

/**
 * Skill adjustment to a pass's difficulty. `weatherMod` is the weather's own
 * penalty (so Storm-Thrower can soften it); the caller clamps the total.
 */
export const passDifficultyModifier = (
  thrower: Player,
  distance: number,
  weather: Weather,
  weatherMod: number,
  receiver: Player | undefined,
  players: Player[]
): number => {
  let mod = 0;
  if (hasSkill(thrower, 'strong_arm') && distance >= 5) mod--;
  if (hasSkill(thrower, 'storm_thrower') && weatherMod > 0) mod--;
  if (hasSkill(thrower, 'starlit_aim') && weather === Weather.CLEAR) mod--;
  if (receiver && receiver.team === thrower.team && hasSkill(receiver, 'sure_hands')) mod--;
  if (standingNeighbours(thrower, players, false).some((e) => hasSkill(e, 'grave_chill'))) mod++;
  return mod;
};

/** Extra Move a player gets this turn from skills (Fleet, Charge). */
export const moveBonus = (p: Player, startsWithBall: boolean): number =>
  (hasSkill(p, 'fleet') ? 1 : 0) + (hasSkill(p, 'charge') && !startsWithBall ? 1 : 0);

/** Starting mana given the role's base (Deep Well adds 1). */
export const startingMana = (p: Player, base: number): number => base + (hasSkill(p, 'deep_well') ? 1 : 0);

/** The most mana Mana Spark can raise a wizard to. */
export const manaSparkCap = (p: Player, base: number): number => startingMana(p, base) + 1;

/** A spell's range for this caster (Far-Caster: +1 on Fireball and Blink). */
export const spellRange = (caster: Player, spellKey: string, baseRange: number): number =>
  baseRange + (hasSkill(caster, 'far_caster') && (spellKey === 'FIREBALL' || spellKey === 'TELEPORT') ? 1 : 0);

/** Bonus to the armor save (Iron Hide). */
export const armorSaveBonus = (p: Player): number => (hasSkill(p, 'iron_hide') ? 1 : 0);

/** Whether a terrain effect skips this mover (Mudborn, Forge-born, Ice Skater). */
export const ignoresTerrain = (p: Player | undefined, terrain: TerrainType): boolean => {
  if (!p) return false;
  if (terrain === TerrainType.MUD) return hasSkill(p, 'mudborn');
  if (terrain === TerrainType.LAVA) return hasSkill(p, 'forge_born');
  if (terrain === TerrainType.ICE) return hasSkill(p, 'ice_skater');
  return false;
};

/** True when a knocked-down player keeps the ball (Ball Clamp). */
export const keepsBallWhenDowned = (p: Player): boolean => hasSkill(p, 'ball_clamp');

export interface DownResult {
  /** The player after the knockdown: stunned, or (Unliving) still up with the skill spent. */
  player: Player;
  /** True when the player is actually down (stunned). */
  downed: boolean;
  /** A log line when a skill changed the outcome, else null. */
  log: string | null;
}

/**
 * Put a player down after a knockdown that was not saved: stunned with no Move
 * left, unless an unspent Unliving lets them shrug it off once per match.
 * Ball handling stays with the caller (see `keepsBallWhenDowned`).
 */
export const downPlayer = (p: Player): DownResult => {
  if (canUseSkill(p, 'unliving')) {
    return { player: spendSkill(p, 'unliving'), downed: false, log: `${p.name} rises again! (Unliving)` };
  }
  return { player: { ...p, isStunned: true, movesRemaining: 0 }, downed: true, log: null };
};
