---
harness:
  generated_by: plimsoll/0.1
  run_id: r_10968a13b003
  generated_at: 2026-08-10T02:00:58Z
  regenerable: true
---

# Assumptions

### Exact XP values per event (tackle/pass/touchdown/spell), level thresholds, and per-role stat caps are unspecified.

- choice: The builder picks sensible fixed values (e.g. modest per-event XP, a small number of thresholds, caps a few points above starting ROLE_STATS) and documents them in README/GAME_RULES/RuleBookModal/CLAUDE.md.
- rejected: Making the values operator-configurable or asking for confirmation before implementing.
- reversal_cost: cheap

### Whether Task 4 (league mode) should be a hard acceptance criterion.

- choice: Treat league as conditional scope, not a gated acceptance criterion, since the prompt says to skip it entirely unless Tasks 1-3 are complete and it can be finished genuinely; a finished Tasks 1-3 is explicitly the better outcome.
- rejected: Adding league fixtures/standings/simulation as required acceptance commands, which would fail a run that correctly skips Task 4.
- reversal_cost: moderate

### Exact literal wording used to describe the Blizzard move penalty in docs.

- choice: Require the literal phrase '-1 Move' (case-insensitive) to appear alongside Blizzard in README, GAME_RULES, and RuleBookModal so agreement is machine-checkable.
- rejected: Accepting any paraphrase (e.g. 'reduces movement by one'), which cannot be reliably verified by command.
- reversal_cost: cheap

### How old/corrupt saves and rosters should be handled on schema bump.

- choice: Degrade gracefully: migrate when feasible, otherwise reject the old save and roster to fresh state with a user-visible message, never crashing.
- rejected: Silently discarding incompatible data, or hard-failing/throwing on load.
- reversal_cost: moderate

### Whether new flows (XP accrual, rematch) require e2e coverage or unit coverage suffices.

- choice: Require both: pure logic unit-tested in services/rules.ts and the user-visible flows covered by Playwright specs, per the prompt's explicit e2e asks.
- rejected: Unit-only coverage, leaving the visible UI/persistence flows unverified end-to-end.
- reversal_cost: cheap
