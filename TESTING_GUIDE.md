# TESTING_GUIDE.md — Running and Extending the Test Suite

> How-to reference for the test suite described in `PROJECT_CONTEXT.md` §7. Read that section first for *what* the suite covers and *why* it's split the way it is; this file is the *how* — commands, conventions, and what to add when you change something.

---

## 1. Running tests

| Command | Runs |
|---|---|
| `npm run test` | Vitest, both projects (`unit` + `component`), once |
| `npm run test:watch` | Vitest, both projects, watch mode |
| `npx vitest run --project unit` | Only the pure-function tests (fast, no DOM) |
| `npx vitest run --project component` | Only the RTL component tests |
| `npm run test:e2e` | Playwright — builds the app, starts it on a disposable DB and port 3100, runs all specs |
| `npm run typecheck` | `tsc --noEmit` (via `next typegen` first — see the note in §3) |
| `npm run lint` | ESLint (includes the React Compiler-based hooks rules — see §4) |

Run `typecheck` + `lint` + `test` before every commit. Run `test:e2e` before closing out a milestone, or after touching anything in `src/app/api/**`, a page's data-fetching, or the Playwright specs/setup themselves — it's slower (a full production build), so it isn't part of the fast per-step loop.

---

## 2. Where a new test goes

| You changed... | Add a test in... |
|---|---|
| A pure function in `src/lib/engine/**` or another `src/lib/*.ts` module | `src/tests/unit/<module>.test.ts` (node environment — no DOM, no React) |
| A React component in `src/components/**` | `src/tests/component/<Component>.test.tsx` (jsdom + React Testing Library) |
| A full user flow spanning pages/API (roll, journal CRUD, Cambridge → prediction) | `src/tests/e2e/<flow>.spec.ts` (Playwright, real browser, real build) |

Naming: unit/component specs must end in `.test.ts`/`.test.tsx` (matches `vitest.config.mts`'s per-project `include` globs); e2e specs must end in `.spec.ts` (matches `playwright.config.ts`'s `testMatch`). A file that doesn't match its project's glob silently never runs — if a new test file isn't showing up in the run count, check the extension first.

---

## 3. Environment gotchas already hit once (don't re-hit them)

- **`@` path alias**: plain Vitest doesn't read Next.js's bundler config, so `vitest.config.mts` declares its own `resolve.alias` for `@` → `src`. If you add a new top-level alias to `tsconfig.json`, mirror it here too.
- **RTL cleanup**: this project does not use Vitest's `globals: true` (every test file explicitly imports `describe`/`it`/`expect`/`vi` from `"vitest"`), so React Testing Library's automatic `afterEach(cleanup)` never self-registers. `src/tests/setup.ts` (the `component` project's `setupFiles` entry) does it explicitly, alongside `vi.unstubAllGlobals()` to undo any `mockFetchSequence` stub between tests. If you ever see "found multiple elements" errors across tests in the *same* file that pass individually, this is almost certainly the cause — check `setup.ts` is still wired into `vitest.config.mts`.
- **`typecheck` needs `next typegen` first**: Next 16's App Router generates ambient `LayoutProps`/`PageProps` types into `.next/types/` at build/dev time. A bare `tsc --noEmit` on a fresh checkout (no `.next/` yet) false-positives on `layout.tsx`. Always use `npm run typecheck`, never call `tsc` directly.
- **`react-hooks/set-state-in-effect`**: this project's ESLint config (React Compiler-based) flags *any* `setState` call reachable from inside a `useEffect`, including inside an async function's post-`await` continuation — not just the naive synchronous case. This has bitten real code twice (the Spinner's original data-fetch pattern in Milestone 2, the theme system's original localStorage-sync effect in Milestone 4 prep). The fix both times: move state-syncing logic to either (a) a Server Component fetching data and passing it as props (for page-level data), or (b) a `useState` **lazy initializer** for one-time synchronous reads of a browser API like `localStorage`, keeping any `useEffect` DOM-only (no `setState` call inside it at all). If ESLint reports this error, don't work around it with an eslint-disable comment — restructure using one of these two patterns; check `src/components/theme/ThemeProvider.tsx` for a worked example.
- **e2e runs a *production build*, not `next dev`**: Next 16 refuses to start a 2nd `next dev` instance for the same project directory even on a different port, which collides with a manually-running dev server during normal development. `playwright.config.ts`'s `webServer.command` runs `tsx src/tests/e2e/setupDb.ts && next build && next start` instead. This also means: **a Server Component page that reads live DB state must have `export const dynamic = "force-dynamic"`**, or `next build` will silently prerender it as static HTML frozen at build time — this was a real bug caught only when e2e first ran a real build (see `PROJECT_CONTEXT.md` §3). If you add a new page that reads the DB, add this export, then confirm with `npm run test:e2e` (not just `npm run dev`, which never prerenders and would hide the bug).
- **e2e DB isolation**: `src/tests/e2e/setupDb.ts` wipes/migrates/seeds a disposable `./e2e-test.db` (via the `DATABASE_PATH` env var `client.ts` already supports), chained via `&&` *ahead of* `next build`/`next start` in one shell command — not via Playwright's `globalSetup` hook, which was tried first and turned out not to guarantee it finishes before the webServer starts. The real `./dev.db` is never touched by e2e runs. If e2e ever fails with `SQLITE_ERROR: no such table`, check `setupDb.ts` is still the *first* command in `webServer.command`, not a separate `globalSetup`.

---

## 4. What "done" looks like for a test (per `CLAUDE.md`'s Definition of Done)

- A new/changed pure function has at least a happy-path test the moment it's written, before any review pass.
- Edge cases worth adding for engine-adjacent code: the boundary values PROJECT_CONTEXT.md's formulas call out explicitly (e.g. `ieltsRound`'s `.25`/`.75` thresholds, the 7-day weekly-override boundary, all-zero-count pools), not just one happy path.
- A component test should prove the thing it claims to prove — if you can comment out the feature it's testing and the test still passes, it's not a real test. This project caught two such gaps by deliberately reintroducing a bug and confirming the existing test failed (see the Spinner candidate-pool-narrowing test and the `journal.spec.ts` substring-locator fix in git history) — when in doubt about whether a new test is meaningful, do the same: break the feature on purpose, confirm the test catches it, then revert.
- Mocking `fetch`: use `src/tests/component/mockFetch.ts`'s `mockFetchSequence()` rather than hand-rolling a new stub. It matches by call *order*, not URL — know the exact sequence of requests your component makes before writing the mock responses.
