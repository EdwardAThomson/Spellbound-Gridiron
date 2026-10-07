import { describe, it, expect } from 'vitest';
import {
  SKILLS,
  ALL_SKILL_IDS,
  MAX_SKILLS,
  isSkillId,
  raceIdFromName,
  skillPool,
  hasSkill,
  canUseSkill,
  spendSkill,
  skillPicksOwed,
  learnSkill,
  autoPickSkill,
  tackleModifiers,
  passDifficultyModifier,
  moveBonus,
  startingMana,
  manaSparkCap,
  spellRange,
  armorSaveBonus,
  ignoresTerrain,
  keepsBallWhenDowned,
  downPlayer,
} from './skills';
import {
  resolveTackle,
  resolvePass,
  resolveKnockdown,
  resolveTerrainStep,
  turnMove,
  findPath,
  reachableTiles,
  extractRoster,
  applyRoster,
  isRoster,
  MUD_SLIP_CHANCE,
} from './rules';
import { Player, PlayerRole, RaceId, SkillId, TeamSide, TerrainType, Weather } from '../types';
import { ROLE_STATS } from '../constants';

const seq = (values: number[]): (() => number) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const mk = (over: Partial<Player> = {}): Player => {
  const role = over.role ?? PlayerRole.LINEMAN;
  return {
    id: 'p',
    name: 'Tester',
    role,
    team: TeamSide.HOME,
    position: { x: 5, y: 5 },
    stats: { ...ROLE_STATS[role] },
    hasBall: false,
    isStunned: false,
    movesRemaining: ROLE_STATS[role].move,
    actionTaken: false,
    mana: 0,
    xp: 0,
    level: 1,
    skills: [],
    spentSkills: [],
    movedThisTurn: 0,
    movePenalty: 0,
    ...over,
  };
};

const with_ = (...skills: SkillId[]) => ({ skills });

describe('skill catalog and pools', () => {
  it('has 31 skills, each in exactly one role or race pool', () => {
    expect(ALL_SKILL_IDS).toHaveLength(31);
    for (const id of ALL_SKILL_IDS) {
      const def = SKILLS[id];
      expect(def.id).toBe(id);
      expect(Boolean(def.role) !== Boolean(def.race)).toBe(true);
    }
  });

  it('gives each role 3 skills (Wizard 4) and each race 3', () => {
    for (const role of Object.values(PlayerRole)) {
      const n = ALL_SKILL_IDS.filter((id) => SKILLS[id].role === role).length;
      expect(n).toBe(role === PlayerRole.WIZARD ? 4 : 3);
    }
    const races: RaceId[] = ['elves', 'orcs', 'dwarves', 'undead', 'humans'];
    for (const race of races) {
      expect(ALL_SKILL_IDS.filter((id) => SKILLS[id].race === race)).toHaveLength(3);
    }
  });

  it('builds a pool of role + race skills', () => {
    const pool = skillPool(PlayerRole.CATCHER, 'elves');
    expect(pool).toEqual(['slippery', 'sure_hands', 'sprint', 'fleet', 'starlit_aim', 'leap']);
    expect(skillPool(PlayerRole.WIZARD, 'orcs')).toHaveLength(7);
    // An unknown race only offers role skills.
    expect(skillPool(PlayerRole.CATCHER, null)).toEqual(['slippery', 'sure_hands', 'sprint']);
  });

  it('maps display race names to ids', () => {
    expect(raceIdFromName('High Elves')).toBe('elves');
    expect(raceIdFromName('Dark Orcs')).toBe('orcs');
    expect(raceIdFromName('Dwarves')).toBe('dwarves');
    expect(raceIdFromName('Undead')).toBe('undead');
    expect(raceIdFromName('Humans')).toBe('humans');
    expect(raceIdFromName('Lizardmen')).toBeNull();
  });

  it('recognises skill ids', () => {
    expect(isSkillId('brutal')).toBe(true);
    expect(isSkillId('flying')).toBe(false);
    expect(isSkillId(3)).toBe(false);
  });
});

describe('learning skills', () => {
  it('owes one pick at level 3 and two at level 5, capped at MAX_SKILLS', () => {
    expect(skillPicksOwed(mk({ level: 1 }))).toBe(0);
    expect(skillPicksOwed(mk({ level: 2 }))).toBe(0);
    expect(skillPicksOwed(mk({ level: 3 }))).toBe(1);
    expect(skillPicksOwed(mk({ level: 4 }))).toBe(1);
    expect(skillPicksOwed(mk({ level: 5 }))).toBe(MAX_SKILLS);
    expect(skillPicksOwed(mk({ level: 5, ...with_('stonewall') }))).toBe(1);
    expect(skillPicksOwed(mk({ level: 5, ...with_('stonewall', 'bodyguard') }))).toBe(0);
  });

  it('learns an owed skill from the pool', () => {
    const r = learnSkill(mk({ level: 3 }), 'dwarves', 'iron_hide');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.player.skills).toEqual(['iron_hide']);
  });

  it('rejects off-pool, duplicate and unearned picks', () => {
    expect(learnSkill(mk({ level: 3 }), 'dwarves', 'fleet').ok).toBe(false);
    expect(learnSkill(mk({ level: 5, ...with_('stonewall') }), 'dwarves', 'stonewall').ok).toBe(false);
    expect(learnSkill(mk({ level: 2 }), 'dwarves', 'stonewall').ok).toBe(false);
  });

  it('auto-picks deterministically by role preference, then race', () => {
    const blitzer = mk({ role: PlayerRole.BLITZER, level: 5 });
    expect(autoPickSkill(blitzer, 'orcs')).toBe('juggernaut');
    expect(autoPickSkill({ ...blitzer, skills: ['juggernaut'] }, 'orcs')).toBe('frenzy');
    expect(autoPickSkill(mk({ level: 1 }), 'orcs')).toBeNull();
  });
});

describe('once-per-match skills', () => {
  it('can be used once, then is spent', () => {
    const p = mk(with_('slippery'));
    expect(canUseSkill(p, 'slippery')).toBe(true);
    const spent = spendSkill(p, 'slippery');
    expect(canUseSkill(spent, 'slippery')).toBe(false);
    expect(hasSkill(spent, 'slippery')).toBe(true);
  });

  it('always-on skills never spend', () => {
    const p = spendSkill(mk(with_('brutal')), 'brutal');
    expect(canUseSkill(p, 'brutal')).toBe(true);
  });

  it('reads players from older saves that lack skill arrays', () => {
    const legacy = { ...mk(), skills: undefined, spentSkills: undefined } as unknown as Player;
    expect(hasSkill(legacy, 'brutal')).toBe(false);
    expect(skillPicksOwed({ ...legacy, level: 3 })).toBe(1);
  });
});

describe('tackle skills', () => {
  const atk = (over: Partial<Player> = {}) => mk({ id: 'a', name: 'Atk', team: TeamSide.HOME, position: { x: 5, y: 5 }, ...over });
  const def = (over: Partial<Player> = {}) => mk({ id: 'd', name: 'Def', team: TeamSide.AWAY, position: { x: 6, y: 5 }, ...over });

  it('Brutal adds +1 to the attacker', () => {
    expect(tackleModifiers(atk(with_('brutal')), def(), []).atk).toBe(1);
  });

  it('Juggernaut needs 3+ squares moved this turn', () => {
    expect(tackleModifiers(atk({ ...with_('juggernaut'), movedThisTurn: 2 }), def(), []).atk).toBe(0);
    expect(tackleModifiers(atk({ ...with_('juggernaut'), movedThisTurn: 3 }), def(), []).atk).toBe(1);
  });

  it('Rally needs two standing allies next to the attacker', () => {
    const a = atk(with_('rally'));
    const ally1 = mk({ id: 'x1', position: { x: 4, y: 5 } });
    const ally2 = mk({ id: 'x2', position: { x: 5, y: 4 } });
    const downedAlly = mk({ id: 'x3', position: { x: 4, y: 4 }, isStunned: true });
    expect(tackleModifiers(a, def(), [a, ally1, downedAlly]).atk).toBe(0);
    expect(tackleModifiers(a, def(), [a, ally1, ally2]).atk).toBe(1);
  });

  it('Stonewall, Shoulder to Shoulder and Bodyguard help the defender', () => {
    const d = def(with_('stonewall', 'shoulder'));
    const guard = mk({ id: 'g', team: TeamSide.AWAY, position: { x: 7, y: 5 }, ...with_('bodyguard') });
    expect(tackleModifiers(atk(), d, []).def).toBe(1);
    const mods = tackleModifiers(atk(), d, [d, guard]);
    expect(mods.def).toBe(3);
    expect(mods.notes).toEqual(['Stonewall', 'Shoulder to Shoulder', 'Bodyguard']);
  });

  it('feeds the modifiers into resolveTackle', () => {
    // Equal STR and equal dice would bounce; Brutal makes it land.
    const a = atk(with_('brutal'));
    const d = def();
    expect(resolveTackle(a, d, seq([0, 0])).success).toBe(false); // no players: no skills
    const r = resolveTackle(a, d, seq([0, 0]), [a, d]);
    expect(r.success).toBe(true);
    expect(r.log).toContain('Brutal');
  });

  it('Slippery turns one landed tackle into a miss, then is spent', () => {
    const a = atk();
    const d = def(with_('slippery'));
    const first = resolveTackle(a, d, seq([0.99, 0]), [a, d]);
    expect(first.success).toBe(false);
    expect(first.log).toContain('Slippery');
    const second = resolveTackle(a, first.defender, seq([0.99, 0]), [a, first.defender]);
    expect(second.success).toBe(true);
  });
});

describe('pass skills', () => {
  const qb = (over: Partial<Player> = {}) =>
    mk({ id: 'q', role: PlayerRole.QUARTERBACK, position: { x: 5, y: 5 }, ...over });

  it('Strong Arm only helps passes of 5+ squares', () => {
    expect(passDifficultyModifier(qb(with_('strong_arm')), 4, Weather.CLEAR, 0, undefined, [])).toBe(0);
    expect(passDifficultyModifier(qb(with_('strong_arm')), 5, Weather.CLEAR, 0, undefined, [])).toBe(-1);
  });

  it('Storm-Thrower softens bad weather only', () => {
    expect(passDifficultyModifier(qb(with_('storm_thrower')), 3, Weather.CLEAR, 0, undefined, [])).toBe(0);
    expect(passDifficultyModifier(qb(with_('storm_thrower')), 3, Weather.RAIN, 1, undefined, [])).toBe(-1);
  });

  it('Starlit Aim helps in Clear weather', () => {
    expect(passDifficultyModifier(qb(with_('starlit_aim')), 3, Weather.CLEAR, 0, undefined, [])).toBe(-1);
    expect(passDifficultyModifier(qb(with_('starlit_aim')), 3, Weather.RAIN, 1, undefined, [])).toBe(0);
  });

  it('Sure Hands helps a team-mate receiver; Grave Chill hinders a marked thrower', () => {
    const catcher = mk({ id: 'c', role: PlayerRole.CATCHER, position: { x: 5, y: 9 }, ...with_('sure_hands') });
    expect(passDifficultyModifier(qb(), 4, Weather.CLEAR, 0, catcher, [])).toBe(-1);
    const ghoul = mk({ id: 'u', team: TeamSide.AWAY, position: { x: 6, y: 5 }, ...with_('grave_chill') });
    expect(passDifficultyModifier(qb(), 4, Weather.CLEAR, 0, undefined, [ghoul])).toBe(1);
  });

  it('resolvePass applies the modifier and never goes below 2', () => {
    const thrower = qb({ ...with_('strong_arm', 'starlit_aim'), stats: { ...ROLE_STATS[PlayerRole.QUARTERBACK] } });
    const plain = resolvePass(thrower, { x: 5, y: 10 }, seq([0]), 0);
    const skilled = resolvePass(thrower, { x: 5, y: 10 }, seq([0]), 0, { weather: Weather.CLEAR, players: [thrower] });
    expect(plain.difficulty).toBe(7);
    expect(skilled.difficulty).toBe(5);
    const short = resolvePass(qb(with_('starlit_aim')), { x: 5, y: 5 }, seq([0]), 0, { weather: Weather.CLEAR, players: [] });
    expect(short.difficulty).toBe(2);
  });
});

describe('movement, mana and range skills', () => {
  it('Fleet always and Charge without the ball add Move', () => {
    expect(moveBonus(mk(with_('fleet')), true)).toBe(1);
    expect(moveBonus(mk(with_('charge')), false)).toBe(1);
    expect(moveBonus(mk(with_('charge')), true)).toBe(0);
  });

  it('turnMove adds skills and subtracts weather and Hex, never below 1', () => {
    const elf = mk({ role: PlayerRole.CATCHER, ...with_('fleet') });
    expect(turnMove(elf, Weather.CLEAR, false)).toBe(9);
    expect(turnMove(elf, Weather.BLIZZARD, false)).toBe(8);
    expect(turnMove({ ...elf, movePenalty: 1 }, Weather.BLIZZARD, false)).toBe(7);
    expect(turnMove(mk({ stats: { move: 1, strength: 1, skill: 1, armor: 7 }, movePenalty: 1 }), Weather.BLIZZARD, false)).toBe(1);
  });

  it('Deep Well, Mana Spark cap and Far-Caster', () => {
    const wiz = mk({ role: PlayerRole.WIZARD, ...with_('deep_well', 'far_caster') });
    expect(startingMana(wiz, 5)).toBe(6);
    expect(manaSparkCap(wiz, 5)).toBe(7);
    expect(spellRange(wiz, 'FIREBALL', 4)).toBe(5);
    expect(spellRange(wiz, 'TELEPORT', 5)).toBe(6);
    expect(spellRange(wiz, 'HEAL', 1)).toBe(1);
    expect(startingMana(mk({ role: PlayerRole.WIZARD }), 5)).toBe(5);
  });
});

describe('knockdown and terrain skills', () => {
  it('Iron Hide adds 1 to the armor save', () => {
    const dwarf = mk(with_('iron_hide')); // Lineman ARM 9
    expect(armorSaveBonus(dwarf)).toBe(1);
    // A 4 on the die: 13 without, 14 (saved) with Iron Hide.
    expect(resolveKnockdown(mk(), 'lava', seq([0.5])).downed).toBe(true);
    expect(resolveKnockdown(dwarf, 'lava', seq([0.5])).downed).toBe(false);
  });

  it('Unliving shrugs off the first knockdown only', () => {
    const p = mk(with_('unliving'));
    const first = downPlayer(p);
    expect(first.downed).toBe(false);
    expect(first.player.isStunned).toBe(false);
    expect(first.log).toContain('Unliving');
    const second = downPlayer(first.player);
    expect(second.downed).toBe(true);
    expect(second.player.isStunned).toBe(true);
    expect(second.player.movesRemaining).toBe(0);
  });

  it('Ball Clamp keeps the ball', () => {
    expect(keepsBallWhenDowned(mk(with_('ball_clamp')))).toBe(true);
    expect(keepsBallWhenDowned(mk())).toBe(false);
  });

  it('Mudborn, Forge-born and Ice Skater ignore their terrain', () => {
    const open = () => false;
    const slip = seq([MUD_SLIP_CHANCE / 2]);
    expect(resolveTerrainStep(TerrainType.MUD, { x: 2, y: 2 }, { x: 3, y: 2 }, [], open, slip, mk()).knockedDown).toBe(true);
    expect(resolveTerrainStep(TerrainType.MUD, { x: 2, y: 2 }, { x: 3, y: 2 }, [], open, slip, mk(with_('mudborn'))).knockedDown).toBe(false);
    const lava = [{ x: 3, y: 2 }];
    expect(resolveTerrainStep(TerrainType.LAVA, { x: 2, y: 2 }, { x: 3, y: 2 }, lava, open, seq([0]), mk(with_('forge_born'))).knockedDown).toBe(false);
    const skate = resolveTerrainStep(TerrainType.ICE, { x: 2, y: 2 }, { x: 3, y: 2 }, [], open, seq([0]), mk(with_('ice_skater')));
    expect(skate.position).toEqual({ x: 3, y: 2 });
    expect(ignoresTerrain(mk(with_('mudborn')), TerrainType.ICE)).toBe(false);
  });
});

describe('Leap pathing', () => {
  // A wall of players across row 5, x 3..7.
  const wall = (pos: { x: number; y: number }) => pos.y === 5 && pos.x >= 3 && pos.x <= 7;

  it('cannot cross a wall without a jump', () => {
    expect(findPath({ x: 5, y: 4 }, { x: 5, y: 6 }, 2, wall)).toBeNull();
  });

  it('crosses one occupied tile with a jump, never ending on one', () => {
    const path = findPath({ x: 5, y: 4 }, { x: 5, y: 6 }, 2, wall, 1);
    expect(path).toHaveLength(2);
    expect(wall(path![0])).toBe(true);
    expect(path![1]).toEqual({ x: 5, y: 6 });
    expect(findPath({ x: 5, y: 4 }, { x: 5, y: 5 }, 2, wall, 1)).toBeNull();
    const reach = reachableTiles({ x: 5, y: 4 }, 2, wall, 1);
    expect(reach.some((p) => p.x === 5 && p.y === 6)).toBe(true);
    expect(reach.some((p) => wall(p))).toBe(false);
  });

  it('cannot leap two occupied tiles in a row', () => {
    const thick = (pos: { x: number; y: number }) => (pos.y === 5 || pos.y === 6) && pos.x >= 0;
    expect(findPath({ x: 5, y: 4 }, { x: 5, y: 7 }, 3, thick, 1)).toBeNull();
  });

  it('matches the plain BFS when no jump is allowed', () => {
    const none = () => false;
    expect(reachableTiles({ x: 0, y: 0 }, 1, none, 0)).toHaveLength(3);
  });
});

describe('rosters carry skills', () => {
  it('extracts and restores learned skills', () => {
    const vet = mk({ id: 'HOME-0', level: 3, ...with_('stonewall') });
    const roster = extractRoster({ name: 'T', race: 'Dwarves', color: 'gold', score: 0, players: [vet] });
    expect(roster.players[0].skills).toEqual(['stonewall']);
    expect(isRoster(roster)).toBe(true);
    const restored = applyRoster(roster, [mk({ id: 'HOME-0' })]);
    expect(restored[0].skills).toEqual(['stonewall']);
  });

  it('accepts a v1 roster player with no skills, rejects unknown skill ids', () => {
    const base = { id: 'a', name: 'A', role: PlayerRole.LINEMAN, xp: 0, level: 1, stats: { ...ROLE_STATS[PlayerRole.LINEMAN] } };
    expect(isRoster({ name: 'T', race: 'Orcs', color: 'red', players: [base] })).toBe(true);
    expect(isRoster({ name: 'T', race: 'Orcs', color: 'red', players: [{ ...base, skills: ['flying'] }] })).toBe(false);
    const restored = applyRoster({ name: 'T', race: 'Orcs', color: 'red', players: [base as any] }, [mk({ id: 'a' })]);
    expect(restored[0].skills).toEqual([]);
  });
});
