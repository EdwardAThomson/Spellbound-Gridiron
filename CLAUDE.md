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

- **Game engine** (`gameProvider` / `gameModel`) — powers `generateCommentary` and `generateTeamName` in `services/gameAiService.ts`.
- **Assistant engine** (`chatProvider` / `chatModel`) — powers the in-game chatbot in `components/AiAssistantPanel.tsx`. This is the only consumer of the CLI path.

Both engines share the same `serializeGameState` context block (rules + state + recent log) and the same `PROMPT_SNIPPET` persona (`constants/ai_persona.ts` — Coach "Iron-Gut" Ironfist).

### State management

All gameplay state lives in a single `useState<GameState>` in `App.tsx` (~735 lines). There is no reducer, store, or context for game state — only `ApiKeysContext` for keys. New gameplay features generally extend the `GameState` type (`types.ts`) and `App.tsx` handlers. Pure helpers (dice, tackle/pass resolution, distance, player creation) belong in `services/gameUtils.ts`.

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
