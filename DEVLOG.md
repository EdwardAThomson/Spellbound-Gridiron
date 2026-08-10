---
harness:
  generated_by: plimsoll/0.1
  run_id: r_1aabc755bfaa
  generated_at: 2026-08-10T01:10:15Z
  regenerable: true
---

## 2026-08-10 — i_144638ac807e — Task 0: build the headless test harness — refactor rules logic out of App.tsx into a pure, rng-injectable services/rules.ts, add a Vitest unit suite, a Playwright chromium e2e layer with a gitignored screenshot helper, unify them under `npm run check`, and update CLAUDE.md to describe the harness.

Task 0: build the headless test harness

Refactor the pure, deterministic game rules out of `App.tsx`/`gameUtils.ts` into a new rng-injectable `services/rules.ts`. Every function needing randomness takes an injected `Rng` (`() => number`) instead of calling a global, so rolls are seedable; `services/gameUtils.ts` binds the real `Math.random` and keeps its previous exports so `App.tsx` is unaffected. `App.tsx` now uses the shared `scatterBall` helper for the loose-ball and inaccurate-pass paths in place of two inline duplicates.

Add a two-layer harness unified under `npm run check`:

- **Unit (Vitest).** `services/rules.test.ts` covers the extracted rules under `vitest.config.ts` (14 tests). `resolvePass`/`passDistance` intentionally preserve the historical floored-Euclidean distance for now; reconciling it to `2 + manhattan` is Task 1's job.
- **E2E (Playwright, chromium).** `e2e/smoke.spec.ts` drives a real browser against the Vite dev server (started via `webServer` in `playwright.config.ts`) with no API keys, exercising the graceful-degradation path: the start screen renders and a match begins. `e2e/screenshot.ts` provides `saveScreenshot(page, name)` writing to the gitignored `screenshots/` dir (resolved against `process.cwd()`, ESM). The dev server is pinned to port 51789 `--strictPort`.

`.gitignore` now excludes `screenshots/`, `test-results/`, `playwright-report/`, and `playwright/.cache/`. `CLAUDE.md` documents the harness and replaces the "no tests" note. New scripts `test`, `test:e2e`, and `check` land in `package.json`; devDependencies add `@playwright/test`, `vitest`, and lockfile entries.

Verify: all 5 predicates pass, including the full `npm run check` gate (14 Vitest unit tests + 1 Playwright chromium e2e, both passing).

---

Note for next step: Task 0 is complete and green. Carry-forward for Task 1: put new gameplay logic in `services/rules.ts` (rng-injected) with coverage in `services/rules.test.ts`; `gameUtils.ts` binds real `Math.random`. When Task 1 reconciles pass difficulty to `2 + manhattan`, the `rules.test.ts` assertion locking in floored-Euclidean distance must be updated. e2e server is pinned to port 51789 `--strictPort` because 3000 is taken by another running app. Work left in the worktree; no git writes made by me.

## 2026-08-10 — i_81e329846244 — Task 1: fix all six ROADMAP 'Known issues' — wrap App with ApiKeysProvider in index.tsx, batch one commentary request per action from post-action state, add a documented win condition with an input-blocking end-of-game screen, enforce spell range/target validity in services/rules.ts, sync diagonal movement and 2+manhattan pass difficulty across code and rule text, and clean up the TELEPORT mutation with documented ball pickup.

Task 1: fix all six ROADMAP "Known issues"

Wrap `<App />` with `ApiKeysProvider` in index.tsx (removing the in-App
wrapper) so `App`'s `useContext(ApiKeysContext)` sees real keys and cloud
commentary/team-name generation work.

Batch commentary to one LLM request per action: `addLog` now only appends
log lines; the lines from an action are collected and flushed once on the
next tick via `flushCommentary`, reading fresh post-action state through
`gameStateRef` instead of a stale closure, and joining the lines into a
single `generateCommentary` call.

Add a documented win condition: `checkWinner` in services/rules.ts ends the
match at `WIN_SCORE` (21) points or after `MAX_TURNS` (16) turns, returning
the higher-scoring side or a draw. App wires it into both the touchdown and
end-of-turn paths and shows an input-blocking end-of-game screen with a New
Game button (`handleNewGame` resets state and clears queued commentary).

Enforce spell range and target validity via `validateSpellCast` in
services/rules.ts: Fireball (range 4) must hit an enemy, Blink (range 5)
must land on an empty on-board tile, Revitalize (range 1) must clear a
stunned ally. `handleCastSpell` rejects invalid casts before spending mana.

Sync rules with code: settle on diagonal (king's-move) movement and
`2 + manhattan_distance` pass difficulty. `resolvePass` now uses Manhattan
distance (the floored-Euclidean `passDistance` helper is removed), and
GAME_RULES (utils/contextSerializer.ts) plus CLAUDE.md are updated to match.

Clean up TELEPORT: copy the target position instead of mutating
`player.position` in place, and copy both caster and target players. Document
automatic (roll-free) ball pickup as intentional in GAME_RULES.

Extend services/rules.test.ts with coverage for `checkWinner` and
`validateSpellCast`, and update the pass-difficulty test to assert
`2 + manhattan`. Re-export the new pure helpers through services/gameUtils.ts.
ROADMAP marks all six known issues resolved. 22 unit tests pass.

---

Note for next step: Task 1 landed. All four verify checks passed (ApiKeysProvider in index.tsx; rules.ts has fireball/blink/revitalize + range and no Math.random; contextSerializer has 2+manhattan pass difficulty; npx vitest run = 22 passed). 8 files changed (+340 -72), all modifications: App.tsx, index.tsx, services/rules.ts, services/gameUtils.ts, services/rules.test.ts, utils/contextSerializer.ts, CLAUDE.md, ROADMAP.md. No scope creep into Task 2+ (no save/load, terrain art, or README terrain/weather edits). e2e was not run (not in this item's verify list); it would run under `npm run check` at a later gate. Next up is Task 2 (versioned localStorage save/load with exact round-trip fidelity).

## 2026-08-10 — i_0ccebc7d2a4a — Task 2: add versioned localStorage save/load — persist full GameState (plus hasGameStarted) under a versioned key, add Save/Load/New Game controls in the left panel, guarantee exact round-trip fidelity, and handle corrupt/missing saves gracefully without autosaving over the slot.

Task 2: add versioned localStorage save/load

Persist the full GameState plus the UI-level hasGameStarted flag under a
single versioned localStorage key, with explicit Save/Load/New Game controls
in the left panel and exact round-trip fidelity.

- services/saveGame.ts: new module with a versioned JSON envelope
  (SAVE_VERSION 1, SAVE_KEY 'spellbound_gridiron_save_v1'). serializeSave /
  deserializeSave / saveGame / loadGame / hasSave take an injected
  KeyValueStore (defaulting to browser localStorage) so the pure logic is
  unit-testable in node. deserializeSave never throws: missing, non-JSON,
  wrong-version, and structurally broken snapshots all degrade to
  { ok: false, error } with a distinct message, and a failed load is
  read-only so it never clobbers an existing valid save.
- App.tsx: wire handleSave / handleLoad plus a logSystem helper that appends
  save/load feedback to the log without firing an LLM commentary request.
  Save reads gameStateRef.current so any in-flight update is captured; Load
  clears queued commentary, resets the thinking flag, and restores
  hasGameStarted. There is no autosave, so a running match never overwrites
  the slot on its own. Adds a Save / Load / New Game button row in the left
  panel.
- services/saveGame.test.ts: round-trip fidelity (including held ball /
  null ballPosition and a finished game), versioned-key/version-tag checks,
  and graceful handling of missing, non-JSON, wrong-version, and broken
  saves.

Verify: both greps pass (localStorage in services/*.ts; Save/Load button
labels in App.tsx) and npx vitest run reports 31 passed across 2 files.

---

Note for next step: Task 2 is complete in the worktree (M App.tsx, new services/saveGame.ts and services/saveGame.test.ts, +374). Both verify commands passed: the greps match, and `npx vitest run` reports 31 passing tests across 2 files. Save/load is additive UI only with no gameplay-rule or GAME_RULES changes, so e2e was not run and docs were left untouched. Ready for the harness to commit; next up is Task 3 (inline per-terrain SVG art in BoardTile).

## 2026-08-10 — i_d0bbcb2628c8 — Task 3: replace the flat gradient tiles with inline per-terrain SVG art in BoardTile for Grass/Mud/Lava/Ice with deterministic per-tile (x,y-seeded) variation, make terrain selectable on the start screen, and remove the external transparenttextures.com overlay from App.tsx.

Task 3: replace flat gradient board tiles with inline per-terrain SVG art, add start-screen terrain selection, and remove the external transparenttextures overlay.

BoardTile now renders a `TerrainArt` SVG component drawing Grass/Mud/Lava/Ice, each a solid base plus decorative marks whose positions and sizes come from a deterministic `(x, y)`-seeded sin-hash, so tiles vary but stay stable across re-renders. The old flat `bg-*` base/state coloring is restructured: ring and cursor state stay on the root while endzone and interaction tints move to an overlay above the SVG (driven by `group-hover`), so a solid SVG base no longer hides the tint. StartOverlay gains a terrain picker (GRASS/MUD/LAVA/ICE from `TERRAIN_CONFIG`) wired to a new `handleSelectTerrain` handler in App.tsx, and the `transparenttextures.com/stardust.png` field overlay div is deleted from App.tsx.

Verify: all 3 commands passed (no `transparenttextures` in source; `<svg` plus Mud|Lava|Ice present in components; `npm install && npx vitest run` → 31/31). Three files touched: App.tsx, components/BoardTile.tsx, components/StartOverlay.tsx.

---

Note for next step: Task 3 landed and fully verified (31/31 unit tests, all three verify commands green). Worktree holds exactly the three modified files staged-free for the harness; git history and index untouched. Next item is Task 4 (real Mud/Lava/Ice terrain and Rain/Blizzard/Meteor Shower weather mechanics, mirrored across GAME_RULES, RuleBookModal, and README), which builds on the terrain-selection groundwork laid here.

