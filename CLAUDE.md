# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                  # root deps
cd server && npm install     # server deps (separate package.json)

npm run dev                  # frontend (Vite) on port 3000, host 0.0.0.0
npm run start:server         # CLI runner backend on port 3001 (only needed for CLI providers)
npm run build                # vite build
npm run preview              # serve built dist/

npm test                     # Vitest unit suite (pure rules logic)
npm run test:e2e             # Playwright chromium end-to-end smoke test
npm run check                # unit + e2e together (the CI gate)
```

### Test harness

Task 0 added a headless harness runnable as `npm run check` (unit then e2e):

- **Unit layer (Vitest).** The pure, deterministic game rules were extracted from `App.tsx`/`gameUtils.ts` into `services/rules.ts`. Every function that needs randomness takes an injected `Rng` (`() => number`, matching `Math.random`) rather than calling a global, so rolls are seedable. `services/gameUtils.ts` now wraps those with the real `Math.random` and keeps its previous exports (`resolveTackle`, `resolvePass`, `rollDice`, `scatterBall`, …) so `App.tsx` is unaffected. Unit tests live beside the code as `*.test.ts` (e.g. `services/rules.test.ts`) and run under `vitest.config.ts`.
- **E2E layer (Playwright).** Specs in `e2e/*.spec.ts` drive a real Chromium browser against the Vite dev server (Playwright starts it via `webServer` in `playwright.config.ts`). The smoke test runs with no API keys, so it also verifies the graceful-degradation path. `e2e/screenshot.ts` exposes `saveScreenshot(page, name)` which writes into the gitignored `screenshots/` dir; `test-results/` and `playwright-report/` are gitignored too.

When adding gameplay rules, put the pure logic in `services/rules.ts` (rng-injected) and cover it in `services/rules.test.ts`. There is no linter or formatter. TypeScript is `noEmit` — `tsc` is not part of the build; Vite handles transpilation. No type-check script exists.

The dev server is only needed if the user selects a CLI provider (`codex`, `claude-cli`, `gemini-cli`), or to run the Playwright e2e layer. Cloud providers (`openai`, `gemini`, `claude`) run entirely in the browser.

## Architecture

### Two-tier AI architecture

The app routes AI calls through one of two paths, selected by `LLMProvider` (defined in `utils/llmHelper.ts`):

1. **Cloud providers** (`openai` | `gemini` | `claude`) — `utils/llmHelper.ts#generateText` calls the vendor SDKs directly from the browser using `dangerouslyAllowBrowser` and user-supplied keys from `ApiKeysContext`. No backend involved.
2. **CLI providers** (`codex` | `claude-cli` | `gemini-cli`) — `services/cliService.ts` POSTs to `http://localhost:3001/api/tasks`. The Express server (`server/index.js` → `server/runner.js`) spawns the local CLI binary via a per-provider adapter (`server/adapters/{codex,claude,gemini}.js`) and streams stdout/stderr back over SSE (`/api/tasks/:id/stream`). Some adapters use `--output-format stream-json` and `runner.js` parses NDJSON, suppressing non-final messages to keep the UI immersive.

Any new provider needs to be added in three places: `LLMProvider` union (`utils/llmHelper.ts`), `AVAILABLE_MODELS` + `DEFAULT_MODELS` (`constants/models.ts`), and either a `generateText` branch (cloud) or a `server/adapters/` class registered in `server/adapters/index.js` (CLI).

### Dual-engine settings

The UI exposes two independent provider/model pairs (set in `SettingsModal.tsx`, held as state in `App.tsx`):

- **Game engine** (`gameProvider` / `gameModel`) — powers `generateTeamName` in `services/gameAiService.ts` (its only remaining LLM job). Match commentary is deterministic: `services/commentary.ts` classifies an action's batched log lines and draws an announcer line from a pool (rng-injected, no LLM).
- **Assistant engine** (`chatProvider` / `chatModel`) — powers the in-game chatbot in `components/AiAssistantPanel.tsx`. This is the only consumer of the CLI path.

Both engines share the same `serializeGameState` context block (rules + state + recent log) and the same `PROMPT_SNIPPET` persona (`constants/ai_persona.ts` — Coach "Iron-Gut" Ironfist).

### State management

All gameplay state lives in a single `useState<GameState>` in `App.tsx` (~735 lines). There is no reducer, store, or context for game state — only `ApiKeysContext` for keys. New gameplay features generally extend the `GameState` type (`types.ts`) and `App.tsx` handlers. Pure helpers (dice, tackle/pass resolution, distance, player creation) belong in `services/gameUtils.ts`.

### Game modes & screens

The app is organized around a fantasy-styled main menu (Quick Play / Campaign / Tutorial / Settings) that replaces the bare start overlay; the menu is reachable again from inside a match (Quit to Menu) and from the game-over screen without a page reload, and returning to it must not corrupt a running match's save. All modes share the same in-match rules; only the framing around a match differs.

Follow the harness split for each mode: the pure, deterministic, rng-injected logic lives in `services/` and is unit-tested there, and the DOM/React layer in `App.tsx`/`components/` only wires it up.

- **Campaign**: `services/campaign.ts` holds the whole league model: a 4-team double round-robin fixture generator (`generateFixtures`, 12 fixtures), `computeStandings` (3-1-0), a non-LLM rng-injected match simulator (`simulateMatch`, deterministic from team quality), season helpers (`createCampaign`, `recordResult`, `isSeasonComplete`), and a versioned localStorage envelope (`CAMPAIGN_VERSION`/`CAMPAIGN_KEY`, `save`/`loadCampaign`) that degrades on corrupt or missing data. Covered by `services/campaign.test.ts`. The campaign hub UI (standings table, next fixture, play/simulate, season-complete/new-season) consumes this; player fixtures play as normal matches, AI-vs-AI fixtures resolve instantly via `simulateMatch`.
- **Computer opponent**: `services/opponent.ts` is the pure, rng-injected, LLM-free opponent brain (`planOpponentTurn`): it reads a `GameState` snapshot and emits an ordered list of plain-data actions (`OpponentAction`: move/tackle/pass/spell/pass-turn) for one side, covering chase-loose-ball, advance-carrier, favourable tackles, sensible passes, Wizard mana use and hazard avoidance, always terminating within `MAX_OPPONENT_ACTIONS` and ending in `pass-turn`. Covered by `services/opponent.test.ts`. `App.tsx` wires it up: a Quick Play Hotseat/Computer selector (default Computer, in `StartOverlay`), campaign player-fixtures forcing the other team to Computer, `computerSide`/`opponentPlan` state that plans a turn when it becomes the computer's turn and executes the actions one at a time (paced) through the *existing* human handlers (`walkPath`/`handleTackle`/`handlePass`/`handleCastSpell`/`endTurn`), a read-only board plus a visible "Computer's turn" indicator while it plays, and a safe Quit to Menu mid-turn (stops the plan; Resume re-plans the remaining units). The rules-based opponent is a hard requirement: never route it through an LLM.
- **Tutorial**: `services/tutorial.ts` is the data-driven step list (`TUTORIAL_STEPS`): ordered, plain-data coachmark steps, each with an `anchor`, `text`, and a discriminated-union `completion` condition (`isTutorialStep` guards well-formedness). Covered by `services/tutorial.test.ts`. The tutorial UI anchors a coachmark per step, waits for the real action where practical, is skippable, runs on Grass/Clear with no API keys, and returns to the menu without touching saves or rosters.
- **Help**: an always-available in-game entry with two sections, Controls and How-to-play, that reuses `GAME_RULES` (`utils/contextSerializer.ts`) as the single source of truth rather than duplicating rule text.

When you touch any mode/control wording, keep it consistent across `GAME_RULES`, the Help/`RuleBookModal` UI, `README.md`, and this file.

### API keys & environment

- `ApiKeysContext` (`context/ApiKeysContext.tsx`) seeds from `import.meta.env.VITE_{OPENAI,GEMINI,GOOGLE,ANTHROPIC}_API_KEY` and overrides from `localStorage['spellbound_api_keys']`. Users edit keys via Settings.
- `vite.config.ts` also injects `GEMINI_API_KEY` (non-VITE-prefixed) as `process.env.API_KEY` / `process.env.GEMINI_API_KEY` for the legacy `services/geminiService.ts` direct-Gemini path. Two Gemini SDKs are installed (`@google/genai` and `@google/generative-ai`) — the legacy service uses the former, the multi-provider helper uses the latter.

### Two `constants` locations

- `constants.ts` (root) — gameplay tuning: `ROLE_STATS`, `TERRAIN_CONFIG`, `SPELLS`.
- `constants/` (directory) — AI infrastructure: `ai_persona.ts`, `models.ts`.

Both are actively used; do not consolidate without checking imports.

### Path alias

`@/*` resolves to the repo root (`tsconfig.json` paths + `vite.config.ts` resolve.alias).

## Gameplay model (for AI-feature work)

12×18 grid, 5v5, turn-based. Endzones are top/bottom rows. Roles, stats, and spell costs are in `constants.ts` and `ROLE_STATS`. Movement is one square at a time to any of the 8 adjacent tiles (diagonals allowed — `isAdjacent` is a king's move). Combat is `STR + d6` vs `STR + d6`; passing is `SKL + d6` vs `2 + manhattan_distance` (`resolvePass` uses Manhattan distance). Spell ranges (Fireball 4, Blink 5, Revitalize 1) are enforced as Manhattan distance in `validateSpellCast` (`services/rules.ts`). The match ends at 21 points or after 16 turns (`checkWinner`, `WIN_SCORE`/`MAX_TURNS` in `services/rules.ts`); `App` shows an input-blocking end-of-game screen. The `WIZARD` role starts with `INITIAL_MANA` (5); others start with 0. Weather adjusts play: Rain is +1 pass difficulty; Blizzard is +2 pass difficulty (`weatherPassModifier`) plus -1 Move for every player (`weatherMovePenalty` / `effectiveMove` in `services/rules.ts`, clamped to a minimum of 1 square). The serialized rules block sent to the LLM is `GAME_RULES` in `utils/contextSerializer.ts` — keep it in sync if gameplay mechanics change.
