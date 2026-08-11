// The data-driven step list that powers the guided tutorial. This module is
// pure data plus tiny helpers: it describes an ordered sequence of coachmark
// steps and knows nothing about the DOM, React, or how a step is actually
// rendered or its completion detected. The UI layer (a later item) anchors a
// coachmark to the element named by each step's `anchor`, shows its `text`, and
// advances when the step's `completion` condition is met. Keeping the steps as
// plain, serializable data (no closures) is what lets them be unit-tested here
// and drives the "teach by doing" flow deterministically on Grass/Clear.
//
// The tutorial deliberately needs no API keys and no LLM: every step is a
// self-contained instruction with a mechanical completion condition drawn from
// the same gameplay the live match uses (select, move, pick up the ball, score,
// end the turn), so it teaches the real controls rather than a scripted mock.

/**
 * What the player must do for a coachmark step to be considered complete. This
 * is a discriminated union of gameplay events rather than a predicate function
 * so the whole step list stays plain data: serializable, comparable, and
 * unit-testable. The UI maps each `kind` onto the game event that satisfies it.
 *
 * - `acknowledge`   - an informational step; dismissed by clicking Next.
 * - `select-player` - the player selects (clicks) one of their own units.
 * - `move-player`   - the player moves a unit at least one tile.
 * - `pickup-ball`   - a unit picks up the loose ball.
 * - `score-touchdown` - the ball carrier reaches the opponent's endzone.
 * - `end-turn`      - the player ends their turn.
 */
export type TutorialCompletion =
  | { kind: 'acknowledge' }
  | { kind: 'select-player' }
  | { kind: 'move-player' }
  | { kind: 'pickup-ball' }
  | { kind: 'score-touchdown' }
  | { kind: 'end-turn' };

/** The set of valid completion kinds, for well-formedness checks and the UI. */
export const TUTORIAL_COMPLETION_KINDS: TutorialCompletion['kind'][] = [
  'acknowledge',
  'select-player',
  'move-player',
  'pickup-ball',
  'score-touchdown',
  'end-turn',
];

/**
 * One coachmark step. `order` is a strictly-increasing rank used to sequence the
 * steps (the array is authored in this order, but the field makes the ordering
 * explicit and checkable). `anchor` names the UI element the coachmark points
 * at; `text` is the plain-language instruction shown in the bubble; `completion`
 * is the condition that advances the tutorial to the next step.
 */
export interface TutorialStep {
  id: string;
  order: number;
  anchor: string;
  text: string;
  completion: TutorialCompletion;
}

/**
 * The ordered tutorial. A short, hand-authored "teach by doing" path: welcome,
 * then the core loop of selecting a unit, moving it, grabbing the ball, scoring,
 * and ending the turn, closing with where to find Help. Anchors are stable
 * identifiers the UI attaches to the matching elements.
 */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'welcome',
    order: 1,
    anchor: 'board',
    text: 'Welcome to Spellbound Gridiron! This is the pitch: a 12x18 grid, 5 units a side. Score by carrying the ball into the far endzone. Let us walk through a turn.',
    completion: { kind: 'acknowledge' },
  },
  {
    id: 'select-player',
    order: 2,
    anchor: 'player-token',
    text: 'Click one of your units to select it. Your team is highlighted, and the tiles it can reach this turn will light up.',
    completion: { kind: 'select-player' },
  },
  {
    id: 'move-player',
    order: 3,
    anchor: 'reachable-tile',
    text: 'Click any highlighted tile to move there. Your unit walks the shortest path automatically, spending one Move point per square, moving in any of the 8 directions.',
    completion: { kind: 'move-player' },
  },
  {
    id: 'pickup-ball',
    order: 4,
    anchor: 'ball',
    text: 'Move a unit onto the ball to pick it up automatically. No roll needed. Whoever holds the ball can run it or pass it.',
    completion: { kind: 'pickup-ball' },
  },
  {
    id: 'score-touchdown',
    order: 5,
    anchor: 'endzone',
    text: 'Carry the ball into the opponent\'s endzone (the far row) to score a touchdown worth 7 points. First to 21 wins.',
    completion: { kind: 'score-touchdown' },
  },
  {
    id: 'end-turn',
    order: 6,
    anchor: 'end-turn-button',
    text: 'When you have finished moving your units, click End Turn to hand play to your opponent.',
    completion: { kind: 'end-turn' },
  },
  {
    id: 'find-help',
    order: 7,
    anchor: 'help-button',
    text: 'That is the core loop! Open Help any time for the full controls and rules, including passing, tackling, spells, terrain, and weather. Good luck, coach.',
    completion: { kind: 'acknowledge' },
  },
];

/**
 * Structural well-formedness check for a single step: it must carry a non-empty
 * id, a numeric order, a non-empty anchor, non-empty text, and a completion
 * condition whose kind is one this module recognizes. Used by the UI and tests
 * to reject a malformed step rather than render a broken coachmark.
 */
export const isTutorialStep = (v: any): v is TutorialStep =>
  Boolean(
    v &&
      typeof v.id === 'string' &&
      v.id.length > 0 &&
      typeof v.order === 'number' &&
      typeof v.anchor === 'string' &&
      v.anchor.length > 0 &&
      typeof v.text === 'string' &&
      v.text.length > 0 &&
      v.completion &&
      typeof v.completion === 'object' &&
      TUTORIAL_COMPLETION_KINDS.includes(v.completion.kind)
  );
