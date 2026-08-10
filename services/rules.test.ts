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
  isHazard,
  generateLavaHazards,
  resolveTerrainStep,
  chooseMeteorTarget,
  advanceMeteor,
  MUD_SLIP_CHANCE,
  WIN_SCORE,
  MAX_TURNS,
} from './rules';
import { Player, PlayerRole, TeamSide, TerrainType, Weather } from '../types';

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
