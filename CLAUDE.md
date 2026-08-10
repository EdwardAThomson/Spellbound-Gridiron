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
```

There are no tests, linter, or formatter configured. TypeScript is `noEmit` — `tsc` is not part of the build; Vite handles transpilation. No type-check script exists.

The dev server is only needed if the user selects a CLI provider (`codex`, `claude-cli`, `gemini-cli`). Cloud providers (`openai`, `gemini`, `claude`) run entirely in the browser.

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

12×18 grid, 5v5, turn-based. Endzones are top/bottom rows. Roles, stats, and spell costs are in `constants.ts` and `ROLE_STATS`. Combat is `STR + d6` vs `STR + d6`; passing is `SKL + d6` vs `2 + manhattan_distance`. The `WIZARD` role starts with `INITIAL_MANA` (5); others start with 0. The serialized rules block sent to the LLM is `GAME_RULES` in `utils/contextSerializer.ts` — keep it in sync if gameplay mechanics change.
