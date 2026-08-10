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
  WIN_SCORE,
  MAX_TURNS,
} from './rules';
import { Player, PlayerRole, TeamSide } from '../types';

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
