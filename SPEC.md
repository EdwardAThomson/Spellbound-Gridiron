---
harness:
  generated_by: plimsoll/0.1
  run_id: r_10968a13b003
  generated_at: 2026-08-10T02:00:58Z
  regenerable: true
---

## Goal

Continue Spellbound Gridiron (React+TS+Vite) by fully completing, in order, three self-contained gameplay features while keeping `npm run check` green and extended: (Task 1) give Blizzard a -1 Move penalty for all players in addition to its existing +2 pass difficulty, unit-tested and reflected identically in GAME_RULES (utils/contextSerializer.ts), the RuleBookModal, and README; (Task 2) an XP-and-progression system where players earn documented XP from tackles/passes/touchdowns/spell casts, level up into small role-capped stat bumps, display XP/level on the left-panel unit card, and persist across the versioned localStorage save/load round trip (schema version bumped, old saves migrated or rejected gracefully), with pure logic rng-injected in services/rules.ts, unit-tested, plus an e2e assertion that XP visibly accrues after a scoring play; (Task 3) named-slot persistent rosters that carry teams (XP/levels/bumps) across matches with a post-game rematch flow, corrupt/missing data degrading gracefully to fresh teams, unit-tested round-trip fidelity and an e2e rematch test. Task 4 (a minimal 4-team league) is attempted only if Tasks 1-3 are complete and green, and skipped entirely otherwise. Every completed item must leave the game fully playable; no stubs; tests never call a real LLM.

## Mode

closed — The end state is writable in advance: three concretely specified features with defined data (XP awards, level thresholds, role-capped stat bumps), defined persistence semantics, and named verification surfaces (services/rules.ts unit tests, e2e specs, GAME_RULES/RuleBookModal/README doc agreement). Success is a fixed, enumerable checklist rather than an open-ended exploration.

## Acceptance

- Blizzard applies a -1 Move penalty in the pure rules layer and a unit test covers it; the full unit suite passes. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -iqE 'blizzard' services/rules.ts && grep -iqE 'blizzard.*move|move.*blizzard' services/rules.test.ts && npm test`
- All player-facing rule descriptions agree that Blizzard is -1 Move and +2 pass difficulty (README, GAME_RULES in contextSerializer, RuleBookModal). — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -iq blizzard README.md && grep -iq -- '-1 move' README.md && grep -iq -- '-1 move' utils/contextSerializer.ts && grep -Riq -- '-1 move' components/`
- An XP/progression system exists as rng-injected pure logic in services/rules.ts (XP awards, level thresholds, role-capped stat bumps) and is unit-tested; the unit suite passes. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -iqE 'xp|experience' services/rules.ts && grep -iqE 'level|xp' services/rules.test.ts && npm test`
- XP/level state is part of GameState and survives the versioned save/load round trip (schema version bumped, old saves handled), covered by unit tests that pass. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -RiqE 'xp|level' services/*.test.ts && grep -RiqE 'load|save|migrat|version' services/*.test.ts && npm test`
- An e2e spec asserts XP visibly accrues after a scoring play, and the Playwright suite passes. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -RiqE 'xp|level' e2e/ && npm run test:e2e`
- Persistent named-slot rosters (teams with XP/levels/bumps) round-trip through localStorage with graceful degradation on corrupt/missing data, covered by passing unit tests. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -RiqE 'roster' services/rules.ts && grep -RiqE 'roster|slot' services/*.test.ts && npm test`
- A rematch flow reusing persisted rosters after game over is covered by a passing e2e spec. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -Riq 'rematch' e2e/ && npm run test:e2e`
- With the new logic, docs, and e2e specs in place, the full CI gate (unit + e2e) is green. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -iqE 'xp|experience' services/rules.ts && grep -Riq 'rematch' e2e/ && grep -iq -- '-1 move' utils/contextSerializer.ts && npm run check`

## Scope

- Task 1: Blizzard -1 Move penalty for all players (rng-injected pure logic in services/rules.ts), unit test, and matching updates to GAME_RULES (utils/contextSerializer.ts), RuleBookModal, and README.
- Task 2: XP earned from tackle/pass/touchdown/spell-cast with documented values; level thresholds granting role-capped stat bumps (documented caps); XP+level shown on left-panel unit card; XP/level in GameState surviving versioned save/load (schema version bump + migrate-or-reject); pure logic unit-tested; e2e asserting XP accrues after a scoring play.
- Task 3: named save-slot persistent rosters carrying XP/levels/bumps across matches via localStorage without breaking existing saves; post-game rematch flow reusing rosters; graceful degradation on corrupt/missing roster data; unit-tested round-trip fidelity; e2e rematch test.
- Keep and extend the headless harness: new rules logic in services/rules.ts (rng-injected, unit-tested), new flows get Playwright coverage, provider layer stubbed so tests never call a real LLM, `npm run check` stays green.
- Keep every added/changed mechanic in agreement across GAME_RULES (utils/contextSerializer.ts), RuleBookModal, README.md, and CLAUDE.md.
- Maintain the UI quality bar (legible text, clickable buttons with hover/disabled states, sensible placement) and review desktop + narrow viewports via the existing gitignored screenshot helper.
- Task 4 (conditional, not gated): a minimal 4-team league (fixtures, standings table, rng-injected rules-based simulated AI-vs-AI results, player fixtures as real matches, persisted standings) attempted ONLY if Tasks 1-3 are complete and green; otherwise skipped entirely.

## Out of scope

- Skill unlocks / skill catalog
- Injuries
- Tournament mode
- Player trading
- World map
- Any rework of existing terrain/weather visuals beyond what Task 1 (Blizzard) requires
- Adding a linter, formatter, or type-check script (TypeScript remains noEmit; Vite handles transpilation)

## Environment

- node is available for running the app and test harness — probe: `command -v node`
- npm is available to run test/check scripts (npm test, npm run test:e2e, npm run check) — probe: `command -v npm`
- Playwright chromium is installed so the e2e layer (npm run test:e2e / npm run check) can run — probe: `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && npx playwright --version`
- The existing test harness passes on the current tree before this run's work begins — probe: `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && npm run check`
