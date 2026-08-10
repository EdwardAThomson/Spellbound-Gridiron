import { describe, it, expect } from 'vitest';
import {
  TUTORIAL_STEPS,
  TUTORIAL_COMPLETION_KINDS,
  isTutorialStep,
  TutorialStep,
} from './tutorial';

describe('tutorial step list', () => {
  it('is a non-empty list of steps', () => {
    expect(Array.isArray(TUTORIAL_STEPS)).toBe(true);
    expect(TUTORIAL_STEPS.length).toBeGreaterThan(0);
  });

  it('is ordered by a strictly-increasing order field', () => {
    for (let i = 1; i < TUTORIAL_STEPS.length; i++) {
      expect(TUTORIAL_STEPS[i].order).toBeGreaterThan(TUTORIAL_STEPS[i - 1].order);
    }
  });

  it('has a unique id for every step', () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has every step well-formed: anchor, text, and a valid completion condition', () => {
    for (const step of TUTORIAL_STEPS) {
      expect(isTutorialStep(step)).toBe(true);
      // Spell out the well-formedness the helper folds together, so a failure
      // points at the exact missing piece.
      expect(step.anchor.length).toBeGreaterThan(0);
      expect(step.text.length).toBeGreaterThan(0);
      expect(step.completion).toBeTruthy();
      expect(TUTORIAL_COMPLETION_KINDS).toContain(step.completion.kind);
    }
  });

  it('teaches by doing: not every step is a passive acknowledge', () => {
    const interactive = TUTORIAL_STEPS.filter((s) => s.completion.kind !== 'acknowledge');
    expect(interactive.length).toBeGreaterThan(0);
  });
});

describe('isTutorialStep', () => {
  const valid: TutorialStep = {
    id: 'x',
    order: 1,
    anchor: 'board',
    text: 'do a thing',
    completion: { kind: 'acknowledge' },
  };

  it('accepts a fully-formed step', () => {
    expect(isTutorialStep(valid)).toBe(true);
  });

  it('rejects steps missing a field or carrying an unknown completion kind', () => {
    expect(isTutorialStep(null)).toBe(false);
    expect(isTutorialStep({ ...valid, id: '' })).toBe(false);
    expect(isTutorialStep({ ...valid, anchor: '' })).toBe(false);
    expect(isTutorialStep({ ...valid, text: '' })).toBe(false);
    expect(isTutorialStep({ ...valid, completion: undefined })).toBe(false);
    expect(isTutorialStep({ ...valid, completion: { kind: 'teleport' } })).toBe(false);
  });
});
