# QA & Test Coverage — Task List

> Scope: `src/tests/**`, plus flagging (not owning) coverage gaps anywhere else in the repo. Testing strategy/conventions live in `PROJECT_CONTEXT.md` §7 — this file only tracks *what's done vs. pending*. Read `PROGRESS.md` at the repo root first for overall status before this file.

## Done

- [x] Vitest split into two **projects** (`vitest.config.mts`): `unit` (node env, `tests/unit/**`) and `component` (jsdom env via RTL, `tests/component/**`), sharing one `@` path alias
- [x] `tests/setup.ts` — RTL cleanup + `vi.unstubAllGlobals()` per test (required since this project doesn't use Vitest's `globals: true`)
- [x] Unit: `weightedRandom`, `weeklyConstraint`, `bandPrediction`, `ieltsRounding`, `countSoftReset`, `tagUtils`, `spinnerAnimation`
- [x] Component: `Spinner` (animation mocked instantly — its timing has its own unit test), `Journal`, `CambridgeTracker`, `RoundingModeToggle`, `PredictionCards`, `PredictionPageClient` (integration-level: toggle → `PATCH /api/config` → prediction refresh)
- [x] `tests/component/mockFetch.ts` — shared sequential-fetch-response stub helper
- [x] Playwright e2e (`playwright.config.ts`, `tests/e2e/*.spec.ts`): full roll flow, journal CRUD, Cambridge add → prediction dashboard updates a real displayed value (not just "not enough data" disappearing)
- [x] e2e DB isolation — `tests/e2e/setupDb.ts` wipes/migrates/seeds a disposable `./e2e-test.db`, chained via `&&` ahead of `next build && next start` in the webServer command (never touches the real `./dev.db`); runs against a production build since `next dev` refuses a 2nd instance for the same project directory

## Backlog / deferred

- [ ] `TESTING_GUIDE.md` (Milestone 4 Step 2 — how to run/extend the suite, regression-test conventions)
- [ ] CI pipeline integration — not currently requested/planned; open question for later

## Adding a new task

New test-scoped work (a new spec file, closing a coverage gap someone flags) gets a line added here in the same step that adds it, not batched up later. If a gap is found in another scope's code, flag it in that scope's own `*_TASKS.md` (`BACKEND_TASKS.md` / `FRONTEND_TASKS.md`) rather than silently fixing it here.
