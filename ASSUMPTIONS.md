---
harness:
  generated_by: plimsoll/0.1
  run_id: r_a14502efa867
  generated_at: 2026-08-10T21:02:11Z
  regenerable: true
---

# Assumptions

### Which team the computer controls in a Quick Play/campaign match.

- choice: The computer controls the second/away team (team 2); the human keeps the first/home team.
- rejected: Letting the human pick which side the computer plays, or the computer taking the home team.
- reversal_cost: cheap

### Exact location/name of the seeded PRNG helper for Task 1.

- choice: A small seeded PRNG (e.g. mulberry32/xorshift over a hash of season number + fixture identity) added in the services layer and unit-tested there.
- rejected: Inlining seeding logic in App.tsx or campaign UI code.
- reversal_cost: cheap

### How long the visible per-action pacing delay should be during the computer's turn.

- choice: A short fixed delay (~350-500ms) per action, enough to follow log lines without stalling play; the delay is configurable/skippable in tests so e2e stays fast and deterministic.
- rejected: Executing the whole opponent turn instantly with no visible pacing.
- reversal_cost: cheap

### How to make README's 'fully reproducible' claim exactly true (fix code vs soften docs).

- choice: Fix the code (deterministic seeding) and keep/clarify the reproducibility claim so it is literally true.
- rejected: Weakening the docs to drop the reproducibility claim.
- reversal_cost: moderate

### Search depth bound for the opponent planner.

- choice: Evaluate a bounded set of candidate moves per player (greedy/heuristic scoring) with a hard cap on total actions per turn; competent and fast, not optimal.
- rejected: Exhaustive/minimax search over the turn space.
- reversal_cost: moderate

### Tutorial opponent behaviour once a real AI exists.

- choice: Tutorial keeps current behaviour: the opponent stays passive unless the tutorial script says otherwise; tutorial e2e specs stay green.
- rejected: Enabling the active computer opponent inside the tutorial.
- reversal_cost: cheap

### Whether e2e must assert opponent commentary (which needs an LLM) with no API keys.

- choice: e2e asserts opponent actions via log lines and turn hand-back only, not LLM commentary, so it passes with zero API keys.
- rejected: Asserting generated commentary text in e2e.
- reversal_cost: cheap
