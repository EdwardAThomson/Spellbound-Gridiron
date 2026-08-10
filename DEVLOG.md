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

