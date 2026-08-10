---
harness:
  generated_by: plimsoll/0.1
  run_id: r_1aabc755bfaa
  generated_at: 2026-08-10T00:56:51Z
  regenerable: true
---

# Assumptions

### Which win condition to implement (operator offered first-to-21 or highest-after-12-turns, 'pick one').

- choice: A player wins immediately on reaching 21 points; if neither reaches 21 by the end of turn 12, the higher score wins and equal scores are a draw. Documented in GAME_RULES, RuleBookModal, and README.
- rejected: Pure highest-score-after-12-turns with no early-win threshold.
- reversal_cost: cheap

### Where the extracted pure rules logic should live.

- choice: A new services/rules.ts module (legality, tackle, pass, spell validation/effects, scoring, win condition, save (de)serialization), leaving services/gameUtils.ts for the existing lower-level helpers.
- rejected: Growing services/gameUtils.ts to hold all rules logic instead of a dedicated rules.ts.
- reversal_cost: moderate

### Lava terrain behaviour: knockdown-on-entry vs impassable (operator allowed either).

- choice: Deterministic seeded hazard tiles that deal a knockdown (stun + ball drop) when entered, kept passable, with the hazard tiles made visually obvious in the SVG art. Documented as the chosen behaviour.
- rejected: Making lava hazard tiles impassable.
- reversal_cost: cheap

### Automatic ball pickup rule (Known issue #6 asks to decide and document).

- choice: A player without the ball automatically picks it up when they occupy the loose-ball tile (end of a move step), and this is stated in GAME_RULES/RuleBookModal/README.
- rejected: Requiring an explicit pickup action or contested pickup roll.
- reversal_cost: cheap

### How to make Meteor Shower tactical rather than a coin flip.

- choice: Telegraph the struck tile one full round in advance (highlighted on the board) before it resolves at the start of the next round, and persist the pending target in save state.
- rejected: Resolving the strike on a freshly-rolled random tile in the same round with no warning.
- reversal_cost: cheap

### The prompt bundles many verifiable outcomes but only some can be honestly commanded; ROADMAP checkbox updates and pixel-level UI legibility are judgement calls.

- choice: ROADMAP checkbox updates and visual legibility (contrast, button hover/disabled states, screenshot review at desktop + narrow viewports) are handled in-run and self-reviewed via the screenshot helper, but are recorded as acknowledged gaps rather than pass/fail acceptance commands, since no exit status can honestly assert them.
- rejected: Writing a grep like `grep '\[x\]' ROADMAP.md` and calling it acceptance, which would pass on any pre-existing checked box and assert nothing about the run's work.
- reversal_cost: cheap
