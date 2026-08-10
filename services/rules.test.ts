import { describe, it, expect } from 'vitest';
import {
  rollDie,
  isPositionValid,
  isAdjacent,
  manhattanDistance,
  resolveTackle,
  resolvePass,
  scatterPosition,
  getPlayerAtPosition,
  checkWinner,
  validateSpellCast,
  weatherPassModifier,
  weatherMovePenalty,
  effectiveMove,
  isHazard,
  generateLavaHazards,
  resolveTerrainStep,
  chooseMeteorTarget,
  advanceMeteor,
  awardXp,
  applyLevelBump,
  levelForXp,
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  MAX_STAT_BUMP,
  ROLE_GROWTH,
  XP_AWARDS,
  MUD_SLIP_CHANCE,
  WIN_SCORE,
  MAX_TURNS,
} from './rules';
import { Player, PlayerRole, TeamSide, TerrainType, Weather } from '../types';
import { ROLE_STATS } from '../constants';

// A fake rng that yields a fixed sequence, cycling if exhausted. This lets each
// test pin down exactly which "roll" the rules logic sees.
const seq = (values: number[]): (() => number) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const mkPlayer = (over: Partial<Player> = {}): Player => ({
  id: 'p',
  name: 'Tester',
  role: PlayerRole.LINEMAN,
  team: TeamSide.HOME,
  position: { x: 0, y: 0 },
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

describe('rollDie', () => {
  it('maps rng() = 0 to the lowest face', () => {
    expect(rollDie(seq([0]), 6)).toBe(1);
  });

  it('maps rng() just below 1 to the highest face', () => {
    expect(rollDie(seq([0.999]), 6)).toBe(6);
  });

  it('defaults to a six-sided die', () => {
    expect(rollDie(seq([0.5]))).toBe(4);
  });
});

describe('geometry helpers', () => {
  it('validates positions against the board bounds', () => {
    expect(isPositionValid({ x: 0, y: 0 })).toBe(true);
    expect(isPositionValid({ x: -1, y: 0 })).toBe(false);
    expect(isPositionValid({ x: 12, y: 0 })).toBe(false);
    expect(isPositionValid({ x: 0, y: 18 })).toBe(false);
  });

  it('computes manhattan distance', () => {
    expect(manhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
  });

  it('treats diagonals as adjacent but not the tile itself', () => {
    expect(isAdjacent({ x: 2, y: 2 }, { x: 3, y: 3 })).toBe(true);
    expect(isAdjacent({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(false);
    expect(isAdjacent({ x: 2, y: 2 }, { x: 4, y: 2 })).toBe(false);
  });

  it('finds the player standing on a tile', () => {
    const a = mkPlayer({ id: 'a', position: { x: 1, y: 1 } });
    const b = mkPlayer({ id: 'b', position: { x: 5, y: 5 } });
    expect(getPlayerAtPosition({ x: 5, y: 5 }, [a, b])?.id).toBe('b');
    expect(getPlayerAtPosition({ x: 9, y: 9 }, [a, b])).toBeUndefined();
  });
});

describe('resolveTackle', () => {
  it('succeeds when the attacker rolls higher', () => {
    // attack die high, defend die low; equal strength.
    const result = resolveTackle(mkPlayer(), mkPlayer({ id: 'd', name: 'Def' }), seq([0.99, 0]));
    expect(result.success).toBe(true);
    expect(result.attackRoll).toBeGreaterThan(result.defendRoll);
    expect(result.log).toContain('smashed');
  });

  it('fails on a tie (attacker needs strictly higher)', () => {
    const result = resolveTackle(mkPlayer(), mkPlayer({ id: 'd', name: 'Def' }), seq([0, 0]));
    expect(result.success).toBe(false);
    expect(result.log).toContain('bounced off');
  });
});

describe('resolvePass', () => {
  it('succeeds when roll meets the distance-scaled difficulty', () => {
    // distance 0 => difficulty 2; skill 2 + die 6 = 8 >= 2.
    const result = resolvePass(mkPlayer(), { x: 0, y: 0 }, seq([0.99]));
    expect(result.difficulty).toBe(2);
    expect(result.success).toBe(true);
  });

  it('scales difficulty as 2 + manhattan distance to the target', () => {
    // from (0,0) to (3,4): manhattan 7 => difficulty 9.
    const result = resolvePass(mkPlayer(), { x: 3, y: 4 }, seq([0.99]));
    expect(result.difficulty).toBe(9);
  });

  it('fails when the difficulty outruns the roll', () => {
    // far target raises difficulty above a minimal roll.
    const result = resolvePass(mkPlayer(), { x: 11, y: 17 }, seq([0]));
    expect(result.success).toBe(false);
    expect(result.log).toContain('fumbles');
  });
});

describe('checkWinner', () => {
  it('keeps the game running below the cap and turn limit', () => {
    expect(checkWinner(14, 7, 4)).toEqual({ isGameOver: false, winner: null });
  });

  it('ends the game when a team reaches the score cap', () => {
    expect(checkWinner(WIN_SCORE, 7, 4)).toEqual({ isGameOver: true, winner: TeamSide.HOME });
    expect(checkWinner(0, WIN_SCORE, 4)).toEqual({ isGameOver: true, winner: TeamSide.AWAY });
  });

  it('ends the game once the turn limit is passed, awarding the higher score', () => {
    expect(checkWinner(7, 14, MAX_TURNS + 1)).toEqual({ isGameOver: true, winner: TeamSide.AWAY });
  });

  it('reports a draw when scores are level at the end', () => {
    expect(checkWinner(7, 7, MAX_TURNS + 1)).toEqual({ isGameOver: true, winner: null });
  });
});

describe('validateSpellCast', () => {
  const caster = mkPlayer({ id: 'w', team: TeamSide.HOME, position: { x: 5, y: 5 } });

  it('rejects any target beyond the spell range', () => {
    const enemy = mkPlayer({ id: 'e', team: TeamSide.AWAY, position: { x: 5, y: 11 } });
    const r = validateSpellCast('FIREBALL', caster, enemy.position, enemy, 4);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('range');
  });

  it('allows Fireball on an in-range enemy but not an ally or empty tile', () => {
    const enemy = mkPlayer({ id: 'e', team: TeamSide.AWAY, position: { x: 5, y: 8 } });
    const ally = mkPlayer({ id: 'a', team: TeamSide.HOME, position: { x: 5, y: 8 } });
    expect(validateSpellCast('FIREBALL', caster, enemy.position, enemy, 4).valid).toBe(true);
    expect(validateSpellCast('FIREBALL', caster, ally.position, ally, 4).valid).toBe(false);
    expect(validateSpellCast('FIREBALL', caster, { x: 5, y: 8 }, undefined, 4).valid).toBe(false);
  });

  it('requires Blink to land on an empty, on-board tile', () => {
    const occupant = mkPlayer({ id: 'o', team: TeamSide.AWAY, position: { x: 5, y: 8 } });
    expect(validateSpellCast('TELEPORT', caster, { x: 5, y: 8 }, undefined, 5).valid).toBe(true);
    expect(validateSpellCast('TELEPORT', caster, occupant.position, occupant, 5).valid).toBe(false);
  });

  it('only lets Revitalize clear a stunned ally', () => {
    const stunnedAlly = mkPlayer({ id: 'sa', team: TeamSide.HOME, isStunned: true, position: { x: 5, y: 6 } });
    const healthyAlly = mkPlayer({ id: 'ha', team: TeamSide.HOME, isStunned: false, position: { x: 5, y: 6 } });
    const stunnedEnemy = mkPlayer({ id: 'se', team: TeamSide.AWAY, isStunned: true, position: { x: 5, y: 6 } });
    expect(validateSpellCast('HEAL', caster, stunnedAlly.position, stunnedAlly, 1).valid).toBe(true);
    expect(validateSpellCast('HEAL', caster, healthyAlly.position, healthyAlly, 1).valid).toBe(false);
    expect(validateSpellCast('HEAL', caster, stunnedEnemy.position, stunnedEnemy, 1).valid).toBe(false);
  });
});

describe('weatherPassModifier', () => {
  it('adds no difficulty in clear skies', () => {
    expect(weatherPassModifier(Weather.CLEAR)).toBe(0);
  });

  it('makes passes harder in rain and blizzard', () => {
    expect(weatherPassModifier(Weather.RAIN)).toBe(1);
    expect(weatherPassModifier(Weather.BLIZZARD)).toBe(2);
  });

  it('feeds the pass difficulty', () => {
    // distance 0 => base 2; blizzard adds 2 => difficulty 4.
    const clear = resolvePass(mkPlayer(), { x: 0, y: 0 }, seq([0.99]), weatherPassModifier(Weather.CLEAR));
    const blizzard = resolvePass(mkPlayer(), { x: 0, y: 0 }, seq([0.99]), weatherPassModifier(Weather.BLIZZARD));
    expect(clear.difficulty).toBe(2);
    expect(blizzard.difficulty).toBe(4);
  });
});

describe('weatherMovePenalty / effectiveMove', () => {
  it('only a Blizzard costs a Move point', () => {
    expect(weatherMovePenalty(Weather.CLEAR)).toBe(0);
    expect(weatherMovePenalty(Weather.RAIN)).toBe(0);
    expect(weatherMovePenalty(Weather.METEOR_SHOWER)).toBe(0);
    expect(weatherMovePenalty(Weather.BLIZZARD)).toBe(1);
  });

  it('trims every player -1 Move in a Blizzard, clamped at 1', () => {
    // Clear/Rain leave the base Move untouched.
    expect(effectiveMove(8, Weather.CLEAR)).toBe(8);
    expect(effectiveMove(8, Weather.RAIN)).toBe(8);
    // Blizzard shaves one square off, whatever the role's base Move.
    expect(effectiveMove(8, Weather.BLIZZARD)).toBe(7);
    expect(effectiveMove(4, Weather.BLIZZARD)).toBe(3);
    // A unit already at 1 Move stays at 1 (never snowed to a standstill).
    expect(effectiveMove(1, Weather.BLIZZARD)).toBe(1);
  });
});

describe('generateLavaHazards / isHazard', () => {
  it('produces the requested number of distinct interior tiles', () => {
    // A ramping rng keeps every draw distinct so no collisions are dropped.
    let n = 0;
    const rng = () => (n++ % 100) / 100;
    const hazards = generateLavaHazards(6, rng);
    expect(hazards).toHaveLength(6);
    // All interior (off the endzone rows) and unique.
    const keys = new Set(hazards.map((h) => `${h.x},${h.y}`));
    expect(keys.size).toBe(6);
    for (const h of hazards) {
      expect(h.x).toBeGreaterThanOrEqual(1);
      expect(h.x).toBeLessThanOrEqual(10);
      expect(h.y).toBeGreaterThanOrEqual(2);
      expect(h.y).toBeLessThanOrEqual(15);
    }
  });

  it('reports membership by tile coordinates', () => {
    const hazards = [{ x: 3, y: 4 }, { x: 7, y: 9 }];
    expect(isHazard({ x: 3, y: 4 }, hazards)).toBe(true);
    expect(isHazard({ x: 3, y: 5 }, hazards)).toBe(false);
    expect(isHazard({ x: 0, y: 0 }, [])).toBe(false);
  });
});

describe('resolveTerrainStep', () => {
  const open = () => false;

  it('is a no-op on grass', () => {
    const r = resolveTerrainStep(TerrainType.GRASS, { x: 2, y: 2 }, { x: 3, y: 2 }, [], open, seq([0]));
    expect(r).toEqual({ position: { x: 3, y: 2 }, knockedDown: false, log: null });
  });

  it('knocks a mover down on a lava hazard tile', () => {
    const r = resolveTerrainStep(TerrainType.LAVA, { x: 2, y: 2 }, { x: 3, y: 2 }, [{ x: 3, y: 2 }], open, seq([0.99]));
    expect(r.knockedDown).toBe(true);
    expect(r.position).toEqual({ x: 3, y: 2 });
    expect(r.log).toContain('lava');
  });

  it('leaves a lava step on a safe tile untouched', () => {
    const r = resolveTerrainStep(TerrainType.LAVA, { x: 2, y: 2 }, { x: 3, y: 2 }, [{ x: 9, y: 9 }], open, seq([0.99]));
    expect(r.knockedDown).toBe(false);
    expect(r.log).toBeNull();
  });

  it('slips in the mud when the roll is below the slip chance', () => {
    const belowChance = MUD_SLIP_CHANCE / 2;
    const r = resolveTerrainStep(TerrainType.MUD, { x: 2, y: 2 }, { x: 3, y: 2 }, [], open, seq([belowChance]));
    expect(r.knockedDown).toBe(true);
    expect(r.log).toContain('mud');
  });

  it('keeps its footing in the mud when the roll clears the slip chance', () => {
    const r = resolveTerrainStep(TerrainType.MUD, { x: 2, y: 2 }, { x: 3, y: 2 }, [], open, seq([0.99]));
    expect(r.knockedDown).toBe(false);
    expect(r.position).toEqual({ x: 3, y: 2 });
  });

  it('slides one extra tile on ice in the travel direction', () => {
    const r = resolveTerrainStep(TerrainType.ICE, { x: 2, y: 2 }, { x: 3, y: 3 }, [], open, seq([0]));
    expect(r.position).toEqual({ x: 4, y: 4 });
    expect(r.knockedDown).toBe(false);
    expect(r.log).toContain('ice');
  });

  it('stops the ice slide at a blocked or off-board tile', () => {
    // Blocked slide tile: mover rests on the stepped tile instead.
    const blocked = resolveTerrainStep(TerrainType.ICE, { x: 2, y: 2 }, { x: 3, y: 2 }, [], () => true, seq([0]));
    expect(blocked.position).toEqual({ x: 3, y: 2 });
    // Sliding off the right edge (x=11 -> 12 invalid): mover stays at the edge.
    const edge = resolveTerrainStep(TerrainType.ICE, { x: 10, y: 5 }, { x: 11, y: 5 }, [], open, seq([0]));
    expect(edge.position).toEqual({ x: 11, y: 5 });
  });
});

describe('meteor telegraph', () => {
  it('chooses an interior impact tile for the given strike turn', () => {
    const m = chooseMeteorTarget(4, seq([0, 0]));
    expect(m.strikeTurn).toBe(4);
    expect(m.target.x).toBeGreaterThanOrEqual(1);
    expect(m.target.y).toBeGreaterThanOrEqual(1);
    expect(isPositionValid(m.target)).toBe(true);
  });

  it('lands the telegraphed meteor and telegraphs the next one', () => {
    const current = { target: { x: 5, y: 9 }, strikeTurn: 3 };
    const res = advanceMeteor(current, 4, seq([0.5, 0.5]));
    expect(res.strike).toEqual({ x: 5, y: 9 });
    expect(res.next.strikeTurn).toBe(4);
  });

  it('strikes nothing on the opening advance (no meteor telegraphed yet)', () => {
    const res = advanceMeteor(null, 1, seq([0, 0]));
    expect(res.strike).toBeNull();
    expect(res.next.strikeTurn).toBe(1);
  });
});

describe('levelForXp', () => {
  it('starts at level 1 and steps up at each cumulative threshold', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(LEVEL_THRESHOLDS[1] - 1)).toBe(1);
    expect(levelForXp(LEVEL_THRESHOLDS[1])).toBe(2);
    expect(levelForXp(LEVEL_THRESHOLDS[2])).toBe(3);
    expect(levelForXp(LEVEL_THRESHOLDS[3])).toBe(4);
    expect(levelForXp(LEVEL_THRESHOLDS[4])).toBe(MAX_LEVEL);
  });

  it('caps at the maximum level however much XP is banked', () => {
    expect(levelForXp(9999)).toBe(MAX_LEVEL);
  });
});

describe('applyLevelBump', () => {
  it('raises a role growth stat by one, chosen via the rng', () => {
    // LINEMAN growth is [strength, armor]; rng 0.99 => Math.floor(0.99*2)=1 => armor.
    const base = ROLE_STATS[PlayerRole.LINEMAN];
    const r = applyLevelBump(PlayerRole.LINEMAN, base, seq([0.99]));
    expect(r.bumped).toBe('armor');
    expect(r.stats.armor).toBe(base.armor + 1);
    expect(r.stats.strength).toBe(base.strength);
  });

  it('reports no bump when every growth stat is already capped', () => {
    const base = ROLE_STATS[PlayerRole.LINEMAN];
    const capped = { ...base, strength: base.strength + MAX_STAT_BUMP, armor: base.armor + MAX_STAT_BUMP };
    const r = applyLevelBump(PlayerRole.LINEMAN, capped, seq([0]));
    expect(r.bumped).toBeNull();
    expect(r.stats).toEqual(capped);
  });
});

describe('awardXp', () => {
  it('banks XP without a level-up below the next threshold', () => {
    const r = awardXp(mkPlayer(), XP_AWARDS.TACKLE, seq([0]));
    expect(r.player.xp).toBe(XP_AWARDS.TACKLE);
    expect(r.player.level).toBe(1);
    expect(r.leveledUp).toBe(false);
    expect(r.bumped).toEqual([]);
    expect(r.log).toBeNull();
  });

  it('levels up and applies one role-capped bump per level crossed', () => {
    const base = ROLE_STATS[PlayerRole.LINEMAN];
    // rng always 0 => always the first eligible growth stat (strength) until capped.
    const r = awardXp(mkPlayer(), LEVEL_THRESHOLDS[1], seq([0]));
    expect(r.player.xp).toBe(LEVEL_THRESHOLDS[1]);
    expect(r.player.level).toBe(2);
    expect(r.leveledUp).toBe(true);
    expect(r.bumped).toEqual(['strength']);
    expect(r.player.stats.strength).toBe(base.strength + 1);
    expect(r.log).toContain('Level 2');
  });

  it('never bumps a stat past its role cap even at max level', () => {
    const base = ROLE_STATS[PlayerRole.LINEMAN];
    // Enough XP to hit the top level in one award; rng 0 funnels into strength,
    // which caps at +MAX_STAT_BUMP and spills the rest into armor.
    const r = awardXp(mkPlayer(), LEVEL_THRESHOLDS[MAX_LEVEL - 1], seq([0]));
    expect(r.player.level).toBe(MAX_LEVEL);
    expect(r.player.stats.strength).toBe(base.strength + MAX_STAT_BUMP);
    expect(r.player.stats.strength - base.strength).toBeLessThanOrEqual(MAX_STAT_BUMP);
    expect(r.player.stats.armor).toBeGreaterThan(base.armor);
  });

  it('treats a zero or negative award as a no-op that never levels down', () => {
    const start = mkPlayer({ xp: 3, level: 1 });
    expect(awardXp(start, 0, seq([0])).player.xp).toBe(3);
    const neg = awardXp(start, -10, seq([0]));
    expect(neg.player.xp).toBe(3);
    expect(neg.player.level).toBe(1);
    expect(neg.leveledUp).toBe(false);
  });

  it('respects the documented award ordering (touchdown is worth the most)', () => {
    expect(XP_AWARDS.TOUCHDOWN).toBeGreaterThan(XP_AWARDS.TACKLE);
    expect(ROLE_GROWTH[PlayerRole.CATCHER]).toContain('skill');
  });
});

describe('scatterPosition', () => {
  it('nudges the ball one square diagonally and clamps inside the field', () => {
    expect(scatterPosition({ x: 5, y: 5 }, seq([0.9, 0.9]))).toEqual({ x: 6, y: 6 });
    expect(scatterPosition({ x: 5, y: 5 }, seq([0, 0]))).toEqual({ x: 4, y: 4 });
  });

  it('clamps against the border so the ball stays playable', () => {
    // top-left corner drifting further out is pinned to (1, 1).
    expect(scatterPosition({ x: 0, y: 0 }, seq([0, 0]))).toEqual({ x: 1, y: 1 });
    // bottom-right corner pinned to (BOARD_WIDTH-2, BOARD_HEIGHT-2) = (10, 16).
    expect(scatterPosition({ x: 11, y: 17 }, seq([0.9, 0.9]))).toEqual({ x: 10, y: 16 });
  });
});
