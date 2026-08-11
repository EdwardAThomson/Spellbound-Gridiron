import { describe, it, expect } from 'vitest';
import { classifyAction, commentaryFor } from './commentary';

/** An rng that returns the given values in order (repeating the last). */
const seq = (values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

describe('classifyAction', () => {
  it('ranks the touchdown above the pickup that preceded it', () => {
    expect(
      classifyAction(['Catcher 4 picked up the ball!', 'TOUCHDOWN! Catcher 4 scores for The Sentinels!'])
    ).toBe('touchdown');
  });

  it('classifies each event family from its real log wording', () => {
    expect(classifyAction(['Lineman 1 smashed Catcher 4 (Roll: 9 vs 5)!'])).toBe('tackle_hit');
    expect(classifyAction(['Lineman 1 bounced off Catcher 4 (Roll: 5 vs 9)!'])).toBe('tackle_miss');
    expect(classifyAction(['QB 3 throws a perfect spiral! (Roll: 8 vs DC: 6)', 'Catcher 4 catches it!'])).toBe('pass_complete');
    expect(classifyAction(['QB 3 fumbles the pass! (Roll: 3 vs DC: 6)'])).toBe('pass_fumble');
    expect(classifyAction(['Wizard 5 casts Fireball at 4,7!'])).toBe('spell');
    expect(classifyAction(['Catcher 4 slips in the mud!'])).toBe('knockdown');
    expect(classifyAction(['Catcher 4 picked up the ball!'])).toBe('pickup');
    expect(classifyAction(['Catcher 4 reaches Level 2! (skill up)'])).toBe('level_up');
    expect(classifyAction(['Something entirely novel happened'])).toBe('generic');
  });
});

describe('commentaryFor', () => {
  it('draws deterministically from the classified pool with a seeded rng', () => {
    const lines = ['TOUCHDOWN! Catcher 4 scores!'];
    const a = commentaryFor(lines, seq([0]));
    const b = commentaryFor(lines, seq([0]));
    expect(a).toBe(b);
    expect(a).toMatch(/touchdown|in!|across the line|seven points/i);
  });

  it('different rng draws give different lines from the same pool', () => {
    const lines = ['Lineman 1 smashed Catcher 4!'];
    expect(commentaryFor(lines, seq([0]))).not.toBe(commentaryFor(lines, seq([0.9])));
  });
});
