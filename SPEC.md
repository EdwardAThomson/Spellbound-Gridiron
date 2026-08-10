---
harness:
  generated_by: plimsoll/0.1
  run_id: r_df5df1c84aa4
  generated_at: 2026-08-10T14:18:25Z
  regenerable: true
---

## Goal

Continue Spellbound Gridiron (React + TS + Vite) by delivering four mandatory, fully-playable features on top of the existing game: (1) a fantasy-styled main-menu home screen with Quick Play / Campaign / Tutorial / Settings that is reachable again from in-game without a page reload and never corrupts a running match's save; (2) an always-available in-game Help with clearly separated Controls and How-to-play sections, reusing GAME_RULES as the single source of truth; (3) a data-driven, unit-testable, skippable guided Tutorial (Grass/Clear, no keys) that teaches by doing via anchored coachmarks and returns cleanly to the menu without touching saves; and (4) a first-playable Campaign: a 4-team double round-robin league with a 3-1-0 standings table, player fixtures played as normal matches, AI-vs-AI fixtures resolved by a pure rng-injected non-LLM simulator, a campaign hub, a season-complete/new-season flow, and versioned localStorage persistence that survives reload and degrades on corrupt data. npm run check must stay green and be extended (new pure logic in services, rng-injected and unit-tested; every new screen/flow gets Playwright coverage; existing e2e specs updated to navigate the new menu; no test calls a real LLM), and any new mechanic/control must be reflected consistently in GAME_RULES, the RuleBookModal/Help, README.md, and CLAUDE.md.

## Mode

closed — The four tasks each have a definite end state that can be written down in advance (a menu with exactly four named entries, a Help screen with two named sections, a scripted tutorial with a fixed step list, a 4-team double round-robin campaign with a rules-based simulator). Success is checkable by extending the existing deterministic gate (Vitest + Playwright) with new specs and tests, so the terminal state is specifiable up front rather than open-ended.

## Acceptance

- A main-menu e2e spec drives the new home screen (Quick Play / Campaign / Tutorial / Settings), starts a Quick Play match through it, and returns to the menu in-game without a page reload; it passes under Playwright. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && /home/edward/.nvm/versions/node/v22.22.1/bin/npx playwright test e2e/menu.spec.ts`
- An in-game Help e2e spec opens Help and asserts both a Controls section and a How-to-play section are shown, and the Help component reuses GAME_RULES rather than duplicating it. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -rlq GAME_RULES components/ && /home/edward/.nvm/versions/node/v22.22.1/bin/npx playwright test e2e/help.spec.ts`
- The tutorial coachmark step list is data-driven and unit-tested (a non-empty ordered list with anchor/text/completion condition), and a happy-path e2e spec drives the guided tutorial to completion back to the menu. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && /home/edward/.nvm/versions/node/v22.22.1/bin/npx vitest run services/tutorial.test.ts && /home/edward/.nvm/versions/node/v22.22.1/bin/npx playwright test e2e/tutorial.spec.ts`
- The campaign fixture/standings/AI-match-simulator logic is pure and rng-injected, and its unit tests pass — including asserting the double round-robin fixture set for 4 teams is non-empty and correctly sized (12 fixtures) and that the simulator returns a deterministic score for a fixed rng. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && /home/edward/.nvm/versions/node/v22.22.1/bin/npx vitest run services/campaign.test.ts`
- A campaign e2e spec enters Campaign from the menu, renders the standings/hub, plays or advances a fixture, and confirms campaign state persists across a reload; it passes under Playwright. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && /home/edward/.nvm/versions/node/v22.22.1/bin/npx playwright test e2e/campaign.spec.ts`
- The full CI gate (npm run check = Vitest unit + Playwright e2e) stays green with all four new specs/tests present and wired in. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && test -f e2e/menu.spec.ts && test -f e2e/help.spec.ts && test -f e2e/tutorial.spec.ts && test -f e2e/campaign.spec.ts && test -f services/campaign.test.ts && test -f services/tutorial.test.ts && /home/edward/.nvm/versions/node/v22.22.1/bin/npm run check`
- README.md documents the new Main-menu/Campaign/Tutorial modes so gameplay docs do not drift. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -q Campaign README.md && grep -q Tutorial README.md`

## Scope

- Replace the current start overlay with a fantasy-styled main-menu home screen offering exactly Quick Play, Campaign, Tutorial, Settings, reachable again in-game (game-over screen + a quit-to-menu control) without a page reload and without corrupting a running match's save
- Add an always-available in-game Help with separated Controls and How-to-play sections, reusing GAME_RULES; update RuleBookModal/Game Rules button accordingly
- Implement a data-driven, unit-testable, skippable tutorial (Grass/Clear, no API keys/backend) with anchored coachmarks covering select/move/tackle/pickup/pass/spell/end-turn/scoring, waiting on real actions where practical and handling both dice outcomes, not touching saves or rosters
- Implement first-playable Campaign: 4-team double round-robin fixtures, 3-1-0 standings table, player fixtures as normal matches, pure rng-injected non-LLM AI-vs-AI match simulator based on team quality, campaign hub (standings + next fixture + Continue/Play Next), season-complete/new-season flow (rosters carry, standings reset), versioned localStorage persistence that resumes, survives reload, and degrades on corrupt/missing data; player XP persists via existing roster system
- Put new pure logic in services (rng-injected) with Vitest coverage and give every new screen/flow Playwright coverage; update existing e2e specs to navigate via the new menu so npm run check stays green; ensure no test calls a real LLM
- Keep GAME_RULES (utils/contextSerializer.ts), the RuleBookModal/Help, README.md, and CLAUDE.md consistent with any added/changed mechanic or control
- Meet the UI quality bar and review new screens via the screenshot helper at desktop and narrow viewports

## Out of scope

- Tournament/knockout mode
- Player trading
- World map
- Skill unlocks
- Injuries
- Multiplayer
- Any rework of existing terrain/weather/XP mechanics
- Adding new LLM providers or changing the two-tier AI architecture

## Environment

- Node v22.22.1 is available for running npm scripts and Vitest/Playwright — probe: `/home/edward/.nvm/versions/node/v22.22.1/bin/node --version`
- npm 11.19.0 is available to run the test/check scripts — probe: `/home/edward/.nvm/versions/node/v22.22.1/bin/npm --version`
- The Playwright CLI/toolchain is present so e2e specs can run against the Vite dev server started by playwright.config.ts webServer — probe: `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && /home/edward/.nvm/versions/node/v22.22.1/bin/npx playwright --version`
- The project's existing gate (Vitest unit + Playwright chromium) is green before this run, so any post-run red is attributable to this run's changes — probe: `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && /home/edward/.nvm/versions/node/v22.22.1/bin/npm run check`
- The e2e smoke path runs with no API keys and no backend (graceful degradation), so tests need no LLM credentials — probe: `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -rq webServer playwright.config.ts`
