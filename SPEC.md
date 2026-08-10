---
harness:
  generated_by: plimsoll/0.1
  run_id: r_a14502efa867
  generated_at: 2026-08-10T21:02:11Z
  regenerable: true
---

## Goal

Add a real, deterministic, rules-based computer opponent to Spellbound Gridiron across three mandatory tasks: (1) make the campaign simulator honestly reproducible by deriving each simulated fixture's rng deterministically from the season number and fixture identity via a seeded PRNG helper in the services layer (removing the App.tsx `simulateMatch(home, away, Math.random)` call) and correcting the docs; (2) implement a pure, rng-injected, unit-tested opponent brain in a new services module (e.g. services/opponent.ts) that emits an ordered list of plain-data actions (move/tackle/pass/spell/pass-turn) covering the required heuristics (chase loose ball, advance carrier toward the correct endzone, favourable tackles, sensible passes, Wizard mana use, hazard/terrain avoidance) with a hard action cap that always produces a legal, terminating turn and never uses an LLM; and (3) wire it into the game with a Quick Play opponent selector (Hotseat/Computer, default Computer), campaign player-fixtures defaulting the other team to Computer, a visible opponent-turn indicator, paced action execution through the existing handlers, safe quit-to-menu mid-turn, and Playwright coverage of a Quick Play and a campaign match against the Computer. `npm run check` must stay green with no API keys, and all added mechanics/controls must stay consistent across GAME_RULES, Help/RuleBookModal, README.md, and CLAUDE.md.

## Mode

closed — The desired end state is fully specifiable in advance: named new modules (seeded PRNG helper, services/opponent.ts), specific unit/e2e tests, a specific UI selector and indicator, and a green `npm run check`. Every deliverable can be written down and commanded now, so the run is closed.

## Acceptance

- A new pure opponent-brain module exists in the services layer exposing a turn-planner and containing no LLM/network calls. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && test -f services/opponent.ts && grep -Eq "export (function|const) (planTurn|planOpponentTurn|planActions|planOpponentActions)" services/opponent.ts && ! grep -Eiq "llmHelper|generateText|dangerouslyAllowBrowser|fetch\(|openai|anthropic|@google" services/opponent.ts`
- Opponent decision logic is unit-tested with seeded rng, covering the required edge cases, and the whole Vitest suite passes. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && test -f services/opponent.test.ts && [ "$(grep -Eic "stun|no legal|zero mana|blocked|boxed|loose ball|terminat|hard cap|own endzone" services/opponent.test.ts)" -ge 4 ] && /home/edward/.nvm/versions/node/v22.22.1/bin/npm test`
- The campaign simulator no longer draws from Math.random in App.tsx; simulated fixtures are seeded deterministically. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && ! grep -Eq "simulateMatch\([^)]*Math\.random" App.tsx`
- A seeded-PRNG determinism/reproducibility test exists in the services layer and the unit suite passes with it. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -rEli "seed|determinist|reproduc" services --include=*.test.ts | grep -q . && /home/edward/.nvm/versions/node/v22.22.1/bin/npm test`
- Quick Play setup exposes an opponent selector offering Hotseat and Computer. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -rEl "Hotseat" --include=*.tsx . | grep -q . && grep -rEli "computer" --include=*.tsx . | grep -q .`
- A visible opponent-turn indicator is rendered in the UI during the computer's turn. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -rEli "opponent'?s turn|computer'?s turn|opponent is thinking|computer is thinking" --include=*.tsx . | grep -q .`
- Playwright e2e covers a match against the Computer opponent (Quick Play and a campaign player-fixture) and the e2e suite passes with no API keys. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -rEli "computer|opponent" e2e --include=*.spec.ts | grep -q . && /home/edward/.nvm/versions/node/v22.22.1/bin/npm run test:e2e`
- Docs are updated so the reproducibility claim is exactly true and the computer opponent is documented consistently in README.md and CLAUDE.md. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -qiE "computer opponent|rules-based opponent|AI opponent|opponent AI" README.md && grep -qiE "computer opponent|rules-based opponent|opponent (brain|AI)" CLAUDE.md`
- The full CI gate (`npm run check`, unit + e2e) is green with the new opponent module and e2e spec present. — `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && test -f services/opponent.ts && ls e2e/*.spec.ts | xargs grep -lEi "computer|opponent" | grep -q . && /home/edward/.nvm/versions/node/v22.22.1/bin/npm run check`

## Scope

- Task 1: seeded PRNG helper in the services layer, unit-tested, used to derive each simulated fixture's rng from season number + fixture identity; remove App.tsx's Math.random seeding of simulateMatch; correct the reproducibility claim in the docs.
- Task 2: services/opponent.ts pure, rng-injected, unit-tested turn planner emitting ordered plain-data actions, covering the required heuristics, with a hard action cap guaranteeing a legal, terminating turn and no LLM use.
- Task 3: Quick Play opponent selector (Hotseat/Computer, default Computer); campaign player-fixtures default the other team to Computer; opponent-turn indicator; paced execution of opponent actions through existing handlers; input blocked but menus/Help accessible; safe quit-to-menu mid-turn; Playwright coverage for Quick Play and a campaign player-fixture vs Computer.
- Keep GAME_RULES (utils/contextSerializer.ts), Help/RuleBookModal, README.md, and CLAUDE.md consistent for any added control/mechanic.
- Keep `npm run check` green with no API keys; review new/changed screens via the screenshot helper at desktop and narrow viewports.

## Out of scope

- LLM-driven opponents
- Difficulty levels
- Per-race stat lines
- Changing team quality or simulator scoring beyond Task 1's seeding
- Tournament mode
- Trading
- World map
- Multiplayer

## Environment

- Node and npm are available at the nvm-managed paths used in verify commands. — probe: `/home/edward/.nvm/versions/node/v22.22.1/bin/npm --version && /home/edward/.nvm/versions/node/v22.22.1/bin/node --version`
- The repository under test is present with its package.json test scripts (test, test:e2e, check). — probe: `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && /home/edward/.nvm/versions/node/v22.22.1/bin/node -e "const s=require('./package.json').scripts; process.exit(s.test&&s['test:e2e']&&s.check?0:1)"`
- App.tsx currently seeds simulateMatch with Math.random (the gap Task 1 closes). — probe: `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && grep -Eq "simulateMatch\([^)]*Math\.random" App.tsx`
- The pre-existing unit + e2e harness is green before this run, so regressions introduced by the run are attributable. — probe: `cd /home/edward/Projects/octonion-software/Spellbound_Gridiron && /home/edward/.nvm/versions/node/v22.22.1/bin/npm run check`
