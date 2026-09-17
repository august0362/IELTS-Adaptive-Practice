# PROGRESS.md — Central Coordination Dashboard

> Read this file first in any new session, before anything else. It tells you exactly where the project stands and what to do next, without needing to scan git history. For the *rules* of how work proceeds, see [`CLAUDE.md`](./CLAUDE.md). For *technical contracts* (schema, formulas, API shapes), see [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md). For the detailed *build history* (bugs found, decisions made, per milestone), see [`document.txt`](./document.txt).

---

## Current status

**Milestone 3 (QA/Testing) is DONE.** All automated gates green: `npm test` (unit+component), `npm run test:e2e`, `npm run typecheck`, `npm run lint`.

**Next action: start Milestone 4 (Supervisor)** — full expert-mode review pass over the entire app, then write `USER_GUIDE.md`, finalize `TESTING_GUIDE.md`, and reconcile `document.txt` (mark backlog items that got built, keep the rest). See `CLAUDE.md`'s milestone-gated workflow for how to run this review (diff-scoped where a diff exists; Milestone 4's own review is necessarily a full-app pass since that's its stated job, not a violation of the "don't re-scan everything" rule).

**Known non-blocking item:** an untracked `src/theme/` directory (Color Hunt palette PNGs, predates this project, unreferenced by any code) sits in the working tree. Left alone per the user's explicit choice — not committed, not deleted. Not part of any milestone's scope.

---

## Milestone overview

| Milestone | Scope | Status | Task list |
|---|---|---|---|
| Phase 0 | Foundation docs (`PROJECT_CONTEXT.md`, `CLAUDE.md`, `document.txt`) | Done | — |
| 1 — Backend/Algorithm | Scaffold, DB, math engine, API routes | Done | [`src/lib/BACKEND_TASKS.md`](./src/lib/BACKEND_TASKS.md) |
| 2 — Frontend/UI | Spinner, Journal, Prediction Dashboard | Done | [`src/app/FRONTEND_TASKS.md`](./src/app/FRONTEND_TASKS.md) |
| 3 — QA/Testing | Unit, component, e2e tests | **Done** | [`src/tests/TEST_TASKS.md`](./src/tests/TEST_TASKS.md) |
| 4 — Supervisor | Full review, `USER_GUIDE.md`, finalize `TESTING_GUIDE.md` | Pending | — (Supervisor's own pass, no separate task file) |

Each scope's `*_TASKS.md` is the granular, checklist-level record for that layer (`- [ ]` / `- [x]`) — update it in the same step that finishes a task, not in a batch afterward. This file only tracks milestone-level status; don't duplicate task detail here.

---

## How to pick up work here (context scoping)

A session or agent starting work on this project should read, in order:

1. **This file** — for current status and which milestone is active.
2. **Only the `*_TASKS.md` for the scope you're working in** (`src/lib/BACKEND_TASKS.md`, `src/app/FRONTEND_TASKS.md`, or `src/tests/TEST_TASKS.md`) — for the granular checklist.
3. **Only the `PROJECT_CONTEXT.md` section(s) your task actually touches** — not the whole document, unless you're doing a full-app review (Milestone 4's job).

Do not read source code or docs for a different scope "to refresh context" unless the task genuinely crosses scope boundaries — a passing automated test suite is the trust signal for everything you're not actively changing.
