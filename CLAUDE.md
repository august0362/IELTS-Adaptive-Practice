# CLAUDE.md — Operating Rules

> Process/ownership source of truth. For *what to build* (schema, formulas, API contracts), see [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md). For *what already happened* (milestone-by-milestone build history, bugs found, decisions made), see [`document.txt`](./document.txt). This file stays short on purpose — it's the rulebook, not the log.

---

## Roles (file ownership, unchanged)

| Role | Owns | Job |
|---|---|---|
| **Supervisor** | Docs, milestone gate | Runs the one gated review per milestone (see below); keeps `PROJECT_CONTEXT.md`/`CLAUDE.md`/`document.txt` current. |
| **Backend/Algorithm** | `drizzle.config.ts`, `drizzle/`, `src/app/api/**`, `src/lib/engine/**`, `src/lib/db/**`, `src/lib/types/**` | Schema, migrations, the 5 pure formula modules, API routes. Never changes a formula's shape without updating `PROJECT_CONTEXT.md` §5 in the same step and flagging behavior changes to the user. |
| **Frontend/UI** | `src/app/**` (pages), `src/components/**` | Pages/components per `PROJECT_CONTEXT.md`. Never invents an API shape — flag it instead of guessing. |
| **QA/Testing** | `src/tests/**` | Unit (Vitest, node), component (Vitest+RTL, jsdom), e2e (Playwright) tests. Flags any `PROJECT_CONTEXT.md` requirement with no corresponding test rather than silently skipping it. |

These are hats the same session wears in sequence, not separate spawned agents — the only agent this file has you spawn is the milestone-gate review below.

---

## Workflow: Milestone-Gated Review with Focused Context

**Why this changed:** reviewing every small step (a file, a component, a route) with a full adversarial subagent burned tokens far out of proportion to the risk at that grain. Gate review at the milestone boundary instead; self-check everything smaller with automated commands.

### Inside a milestone — no subagent review per step

- Execute the milestone's steps yourself, sequentially.
- After each step, self-verify with automated commands only: `npm run typecheck`, `npm run lint`, `npm run test`, and for UI work a direct smoke check (dev server + curl, or a quick manual pass). **Do not spawn a review subagent for a single step, ever.**
- Commit each step normally — commits stay granular for rollback safety even though review does not.

### At milestone completion — exactly one gated review

- Once every step in the milestone is implemented and self-verified green, spawn **one** Supervisor review agent — not before, not per-step.
- Scope it tightly: `git diff` from the milestone's first commit to now, plus the specific `PROJECT_CONTEXT.md` sections and schema/type files that diff touches. **Never instruct it to re-scan the whole codebase or re-review a prior, already-gated milestone.**
- **Re-check loop, max 2 iterations:** if the review finds real issues, fix them, then self-verify the fix via automated commands first. Only spawn a second scoped review pass (diff of the fix only, not the milestone again) if the fix touches something automated tests genuinely can't cover (e.g. a design/contract judgment call). Stop after 2 iterations regardless of outcome; log anything still unresolved to `document.txt` rather than looping further.
- Commit the review's fixes, log the milestone's completion in `document.txt`, then move to the next milestone.

### Context scoping (lazy loading)

- Starting a milestone: load only that milestone's `PROJECT_CONTEXT.md` sections and the schema/types it directly depends on.
- Don't re-read a prior module's source "to refresh context" if its automated tests are still green — a passing test suite is the trust signal, not a fresh read.

---

## Definition of done (per step, self-checked — no agent needed for this)

1. Code matches `PROJECT_CONTEXT.md`; update the doc in the same step if a schema/formula/API contract changed.
2. New or changed logic has a test.
3. `typecheck` + `lint` + `test` all green.
4. Any newly-deferred idea goes to `document.txt`, not lost mid-conversation.

---

## Milestone status

Detailed build history (what was built, bugs found and fixed, decisions made) lives in `document.txt` — this table is just current status.

| Milestone | Scope | Status |
|---|---|---|
| Phase 0 | Foundation docs | Done |
| 1 — Backend/Algorithm | Scaffold, DB, math engine, API routes | Done |
| 2 — Frontend/UI | Spinner, Journal, Prediction Dashboard (5 steps) | Done |
| 3 — QA/Testing | Component tests (done), e2e tests (in progress) | In progress |
| 4 — Supervisor | Full review pass, `USER_GUIDE.md`, finalize `TESTING_GUIDE.md`, reconcile `document.txt` | Pending |

Exit criteria per milestone stay as originally defined in `document.txt`'s per-milestone entries (e.g. Milestone 3: `npm test` and `npx playwright test` both green, `TESTING_GUIDE.md` written).
