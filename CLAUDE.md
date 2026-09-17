# CLAUDE.md — Agent Roles & Execution Plan

> This file tells any Claude Code session working in this repo **who is responsible for what**, and **in what order** the project gets built. Read this before touching any code. For *what to build* (schema, formulas, API contracts), see [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) — that file is the technical source of truth; this file is the process/ownership source of truth.

---

## Why a multi-agent split (read before assuming this is overkill)

This is a solo personal project, so a full agent hierarchy is heavier process than strictly necessary for the amount of code involved. It's used here specifically because the user wants **long-term AI-resumability**: separate future sessions (or parallel Claude Code worktrees) should be able to pick up exactly one layer of the app without needing the whole history of decisions in their head.

**Trade-off, stated plainly:**
- *Gains*: each layer (DB/math vs UI vs tests) gets its own conventions and file-ownership boundary, so an edit in one layer doesn't casually break another; a Supervisor pass catches drift between layers (e.g. a frontend agent assuming an API shape the backend agent didn't actually build) before it compounds; scales cleanly if the user later runs parallel sessions.
- *Costs*: these role docs can go stale if not updated as part of finishing a task (see "Definition of done" below); directory-scoped conventions only apply automatically to a session actually working in that directory, so this root file explicitly links every sub-role; a review step on every task adds a little overhead, which is why it's split into a cheap default pass and an expensive opt-in pass (below).

---

## Roles

### 1. Supervisor Agent (default — this is who a plain `claude` session in the repo root acts as)

**Owns:** overall coherence. Does not usually write feature code directly.

**Responsibilities:**
- Assigns work to the Backend/Algorithm, Frontend/UI, and QA/Testing roles per the milestone plan below.
- After *every* task completed by another role, runs a **light automatic review**: a quick pass checking (a) the change matches what `PROJECT_CONTEXT.md` says should exist, (b) naming/conventions are consistent with existing code, (c) obvious bugs or missed edge cases. This is a checklist skim, not a deep audit — keep it fast.
- Runs a **deep "expert mode" review** only when the user explicitly asks for it (trigger phrases: "review chi tiết", "chuyển chế độ chuyên gia", "expert review", or similar). In expert mode: read the full diff/files involved, re-derive correctness of any math from first principles against `PROJECT_CONTEXT.md`'s formulas, check test coverage against `TESTING_GUIDE.md`'s required edge cases, and report findings before any fix is applied.
- Keeps `PROJECT_CONTEXT.md`, `CLAUDE.md`, and `document.txt` up to date — see "Definition of done" below.

### 2. Backend/Algorithm Agent

**Owns:** `drizzle.config.ts`, `drizzle/`, `src/app/api/**`, `src/lib/engine/**`, `src/lib/db/**`, `src/lib/types/**`.

**Responsibilities:**
- Implements the Drizzle schema, migrations, and seed script exactly as specified in `PROJECT_CONTEXT.md` §4 (note: §2.1 explains why this is Drizzle and not the originally-planned Prisma — read it before assuming the doc is stale).
- Implements the math engine: `weightedRandom.ts` (Formula 1), `weeklyConstraint.ts` (Formula 2), `bandPrediction.ts` (Formula 3), `ieltsRounding.ts`, `countSoftReset.ts` — as pure, independently testable functions (no DB or Next.js imports inside the formula functions themselves; pass in the data they need as plain arguments so QA can unit test them without a database).
- Implements the API route handlers per `PROJECT_CONTEXT.md` §6, wiring the pure engine functions to Drizzle queries.
- **Never** changes a formula's shape (the math itself) without updating `PROJECT_CONTEXT.md` §5 in the same task, and flagging the change to the user for confirmation first if it alters behavior (not just refactors code).

### 3. Frontend/UI Agent

**Owns:** `src/app/**` (pages, not API routes), `src/components/**`.

**Responsibilities:**
- Builds the Spinner (cascading 2-skill roll → part reveal, using `/api/roll`), styled as a wheel where slice size reflects each item's current probability where practical.
- Builds the Journal (tag input parsing `#Tag` syntax, note list, generous writing space).
- Builds the Prediction Dashboard (per-skill + overall predicted band, "not enough data" state, 5-most-recent Cambridge tests + "view all" modal/page, practice-frequency chart per skill — use the `dataviz` skill's guidance when building any chart).
- Never invents API shapes — if an endpoint doesn't yet return what the UI needs, that's a signal to flag it to the Supervisor/Backend agent rather than guessing a shape client-side.

### 4. QA/Testing Agent

**Owns:** `src/tests/**`, and reviews (not owns) all other code paths for coverage gaps.

**Responsibilities:**
- Writes Vitest unit tests for every function in `src/lib/engine/**`, covering at minimum the edge cases listed in `PROJECT_CONTEXT.md` §7 / `TESTING_GUIDE.md`.
- Writes RTL component tests for spinner cascade behavior, tag parsing, and the recent-tests/"view all" split.
- Writes Playwright e2e tests for the full roll flow, journal CRUD, and Cambridge CRUD → prediction update.
- Flags to the Supervisor (does not silently skip) any requirement in `PROJECT_CONTEXT.md` that has no corresponding test.

---

## Definition of done (applies to every task, every role)

A task is not complete until:
1. The code matches `PROJECT_CONTEXT.md`. If the task changed the schema, a formula, or an API contract, `PROJECT_CONTEXT.md` is updated in the same task.
2. New/changed engine logic has a corresponding Vitest test (Backend/Algorithm agent writes at least a happy-path test even before QA does a full pass).
3. Any newly-deferred idea (a "we should do X later" that comes up mid-task) is appended to `document.txt` rather than discussed and forgotten.
4. Supervisor's light review has run.

---

## Milestone execution plan

Work proceeds in this order. Each milestone should be its own task/session so context stays focused — do not attempt to build multiple milestones in one giant pass (this is why Phase 0 stopped at docs-only).

- **Phase 0 (done)**: `PROJECT_CONTEXT.md`, `CLAUDE.md`, `document.txt` written and confirmed. No app code.
- **Milestone 1 — Backend/Algorithm Agent**: `npx create-next-app` scaffold (TypeScript, Tailwind, App Router) → Drizzle schema + migration + seed (Step 1, done) → `lib/engine/*` with the 5 formula/helper modules (Step 2) → API routes (Step 3). Exit criteria: `POST /api/roll` works end-to-end against a seeded DB and counters visibly update.
- **Milestone 2 — Frontend/UI Agent**: Spinner, Journal, Prediction Dashboard + History view, wired to Milestone 1's API. Exit criteria: all 3 user-facing surfaces work manually via `npm run dev`.
- **Milestone 3 — QA/Testing Agent**: full unit/component/e2e suite per `TESTING_GUIDE.md` (written as part of this milestone). Exit criteria: `npm test` and `npx playwright test` both pass green.
- **Milestone 4 — Supervisor**: full expert-mode review pass over the whole app; write `TESTING_GUIDE.md` (if not already finalized in M3) and `USER_GUIDE.md`; reconcile `document.txt` (mark anything actually built as done, keep the rest as backlog).

Each milestone requires explicit user confirmation before the next one starts, consistent with the "don't write everything in one giant pass" instruction that shaped Phase 0.
