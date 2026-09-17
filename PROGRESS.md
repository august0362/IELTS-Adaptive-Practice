# PROGRESS.md — Central Coordination Dashboard

> Read this file first in any new session, before anything else. It tells you exactly where the project stands and what to do next, without needing to scan git history. For the *rules* of how work proceeds, see [`CLAUDE.md`](./CLAUDE.md). For *technical contracts* (schema, formulas, API shapes), see [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md). For the detailed *build history* (bugs found, decisions made, per milestone), see [`document.txt`](./document.txt).

---

## Current status

**All 4 originally-scoped milestones are DONE.** The app is feature-complete: Spinner, Journal, Prediction Dashboard, and a Settings/theme picker, backed by a fully tested math engine and API layer (95 unit+component tests, 3 e2e specs, all green), plus `TESTING_GUIDE.md` and `USER_GUIDE.md`.

**Next action: none required.** There is no Milestone 5. Further work is whatever the user asks for next, or an item from `document.txt`'s PENDING backlog (auth, cloud deploy, Band Prediction v2, part-level weekly-minimum safety net, count-soft-reset tuning, adjustable `baseRatio` UI for Writing/Listening, a Config UI for engine constants) — none of it blocks normal use of the app as built. If you're an agent picking up a backlog item, treat it as its own small milestone: read the relevant `document.txt` entry and `PROJECT_CONTEXT.md` section(s), implement, self-check (`typecheck`/`lint`/`test`), and do one gated review at the end per `CLAUDE.md`'s workflow.

**Known non-blocking item:** an untracked `src/theme/` directory (the source Color Hunt/named palette PNGs the theme system's colors were decoded from) sits in the working tree. Left alone per the user's explicit choice — not committed, not deleted, still referenced by `PROJECT_CONTEXT.md` §9 as the design source. A separate untracked `note.txt` also exists, holding a quarantined line removed from `document.txt` (see that file's Milestone 4 Step 1 entry) — also intentionally not committed.

---

## Milestone overview

| Milestone | Scope | Status | Task list |
|---|---|---|---|
| Phase 0 | Foundation docs (`PROJECT_CONTEXT.md`, `CLAUDE.md`, `document.txt`) | Done | — |
| 1 — Backend/Algorithm | Scaffold, DB, math engine, API routes | Done | [`src/lib/BACKEND_TASKS.md`](./src/lib/BACKEND_TASKS.md) |
| 2 — Frontend/UI | Spinner, Journal, Prediction Dashboard | Done | [`src/app/FRONTEND_TASKS.md`](./src/app/FRONTEND_TASKS.md) |
| 3 — QA/Testing | Unit, component, e2e tests | Done | [`src/tests/TEST_TASKS.md`](./src/tests/TEST_TASKS.md) |
| 4 — Supervisor | Theme system, full review, `USER_GUIDE.md`, `TESTING_GUIDE.md` | **Done** | — (Supervisor's own pass, no separate task file) |

Each scope's `*_TASKS.md` is the granular, checklist-level record for that layer (`- [ ]` / `- [x]`) — update it in the same step that finishes a task, not in a batch afterward. This file only tracks milestone-level status; don't duplicate task detail here.

---

## How to pick up work here (context scoping)

A session or agent starting work on this project should read, in order:

1. **This file** — for current status and which milestone is active.
2. **Only the `*_TASKS.md` for the scope you're working in** (`src/lib/BACKEND_TASKS.md`, `src/app/FRONTEND_TASKS.md`, or `src/tests/TEST_TASKS.md`) — for the granular checklist.
3. **Only the `PROJECT_CONTEXT.md` section(s) your task actually touches** — not the whole document, unless you're doing a full-app review.

Do not read source code or docs for a different scope "to refresh context" unless the task genuinely crosses scope boundaries — a passing automated test suite is the trust signal for everything you're not actively changing.
