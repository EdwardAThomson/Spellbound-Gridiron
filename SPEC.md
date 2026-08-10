---
harness:
  generated_by: plimsoll/0.1
  run_id: r_1aabc755bfaa
  generated_at: 2026-08-10T00:56:51Z
  regenerable: true
---

## Goal

Deliver Tasks 0-4 of the Spellbound Gridiron work order in order, each leaving the game fully playable: (0) a headless test harness (Vitest unit layer over rules logic refactored out of App.tsx into a pure, rng-injectable module, plus Playwright chromium e2e with a screenshot helper, unified under `npm run check`); (1) fix all six ROADMAP 'Known issues' (ApiKeysProvider wrapping App in index.tsx, batched one-request-per-action commentary, a documented win condition with end-of-game screen, enforced spell range/target validity, rule/code sync for diagonal movement and 2+manhattan pass difficulty, and TELEPORT mutation cleanup with documented ball pickup); (2) versioned localStorage save/load with Save/Load/New Game controls and exact round-trip fidelity; (3) inline per-terrain SVG art in BoardTile with deterministic variation, terrain selectable on the start screen, and the external transparenttextures overlay removed; (4) real terrain (Mud/Lava/Ice) and weather (Rain/Blizzard/Meteor Shower) mechanics, all mirrored across GAME_RULES, RuleBookModal, and README. LLM features must degrade gracefully with no keys/backend, tests must stub the provider layer, and every gameplay change must stay consistent across code and player-facing docs.

## Mode

closed — The operator prompt is a fixed, ordered task list (Task 0-4) with concrete, checkable end states: specific scripts (npm test / test:e2e / check), named refactors, six enumerated bug fixes, a save schema, SVG terrain, and named terrain/weather effects. The finished state can be written down in advance, so the run is judged against a checklist rather than an open-ended goal.

## Acceptance

- A single `npm run check` gate exists and passes, running both the unit and e2e layers. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && npm run check`
- A Vitest unit suite exists (the set of *.test.ts files is non-empty), covering the extracted rules logic. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && find . -path ./node_modules -prune -o -name '*.test.ts' -print | grep -q .`
- A Playwright chromium e2e layer is configured with a webServer and a test:e2e script. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && test -f playwright.config.ts && node -e "process.exit(require('./package.json').scripts && require('./package.json').scripts['test:e2e'] ? 0 : 1)"`
- Rules logic is extracted into a pure services/rules.ts module that exports functions and never calls Math.random directly (randomness is injected). — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && test -f services/rules.ts && grep -q 'export' services/rules.ts && ! grep -q 'Math.random' services/rules.ts`
- services/rules.ts implements enforced spell range/target validity for the three spells. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && test -f services/rules.ts && grep -qiE 'fireball|blink|revitalize' services/rules.ts && grep -qiE 'range' services/rules.ts`
- ApiKeysProvider wraps the app at the entry point (index.tsx) so the game engine receives keys. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -q 'ApiKeysProvider' index.tsx`
- The external transparenttextures.com overlay is gone from all source (self-contained build). — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && ! grep -rq 'transparenttextures' --include='*.ts' --include='*.tsx' --exclude-dir=node_modules .`
- BoardTile renders inline SVG terrain art, and the non-Grass terrains (Mud/Lava/Ice) are present in the component layer. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -rq '<svg' components --include='*.tsx' && grep -rqiE 'Mud|Lava|Ice' components --include='*.tsx'`
- Versioned localStorage persistence exists in the services layer with Save and Load controls in the UI. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -rqi 'localStorage' services --include='*.ts' && grep -rqE '>[[:space:]]*(Save|Load)\b' components App.tsx --include='*.tsx'`
- GAME_RULES states the pass difficulty as 2 + manhattan distance, matching the code. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -qiE '2 ?\+ ?.*manhattan|manhattan.*distance' utils/contextSerializer.ts`
- New terrain and weather mechanics are documented consistently across GAME_RULES, README, the RuleBookModal, in agreement. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -qiE 'blizzard|meteor' utils/contextSerializer.ts && grep -qiE 'blizzard|meteor' README.md && grep -rqiE 'blizzard|meteor' components --include='*.tsx' && grep -qiE 'mud|lava|ice' utils/contextSerializer.ts`
- The screenshots directory is gitignored. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -q 'screenshots' .gitignore`
- CLAUDE.md no longer claims the project has no tests and instead describes the harness. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && test -f CLAUDE.md && ! grep -q 'no tests, linter' CLAUDE.md`

## Scope

- Task 0: Vitest unit harness with rules logic refactored out of App.tsx into pure, rng-injectable functions; Playwright chromium e2e with webServer autostart and gitignored screenshot helper; unified `npm run check`.
- Task 1: all six ROADMAP 'Known issues' in listed order (ApiKeysProvider placement, batched one-call-per-action commentary, documented win condition + end-of-game screen + input block, spell range/target enforcement with invalid-target feedback, rule/code sync for diagonal movement and 2+manhattan pass difficulty, TELEPORT mutation cleanup + documented ball pickup).
- Task 2: versioned localStorage save/load with Save/Load/New Game controls, exact round-trip fidelity across scores/turn/team/player state/ball/terrain/weather/log, corrupt/missing-save handling, no silent autosave.
- Task 3: inline per-terrain SVG art in BoardTile for Grass/Mud/Lava/Ice with deterministic seeded variation, start-screen terrain selection, external overlay removed.
- Task 4: real Mud/Lava/Ice terrain effects and Rain/Blizzard/Meteor Shower weather effects, save/load preserving terrain+weather+hazard/meteor state, docs synced across GAME_RULES/RuleBookModal/README, ROADMAP checkboxes updated.
- Graceful LLM degradation (fallback commentary, disabled assistant with a clear message) and a stubbed provider layer so tests never call a real LLM.

## Out of scope

- Stretch goals (XP/progression, persistent rosters, league mode) unless all five core tasks are complete and green, and then strictly in order.
- Skill unlocks / skill catalog
- Injuries
- Tournament mode
- Player trading
- The world map
- Any linter/formatter/type-check tooling beyond what the test harness requires

## Environment

- Node v22.22.1 and npm 11.19.0 are available to run the harness and build. — probe: `command -v /home/edward/.nvm/versions/node/v22.22.1/bin/node && command -v /home/edward/.nvm/versions/node/v22.22.1/bin/npm`
- The target repo is a git working tree with README.md, ROADMAP.md, CLAUDE.md, and package.json present. — probe: `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && git rev-parse --is-inside-work-tree && test -f package.json && test -f ROADMAP.md`
- Playwright chromium must be installable/launchable headlessly for the e2e layer; the environment provides no preinstalled browser, so the harness must run `npx playwright install chromium` (or `--with-deps`) before e2e runs. — probe: `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && npx --yes playwright install chromium >/dev/null 2>&1 && npx --yes playwright --version`
- The Vite dev server binds port 3000 (frontend) and the optional CLI backend uses 3001; Playwright's webServer will start Vite on 3000. — probe: `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -q '3000' vite.config.ts`
