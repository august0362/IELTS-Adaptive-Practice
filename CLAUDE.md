# CLAUDE.md — Operating Rules

> Process/ownership source of truth — the rulebook, not the log or the dashboard. For **current status** (which milestone, what's next), see [`PROGRESS.md`](./PROGRESS.md). For **what to build** (schema, formulas, API contracts), see [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md). For **what already happened** (build history, bugs found, decisions made), see [`document.txt`](./document.txt).

---

## Roles (file ownership)

| Role | Owns | Task list | Job |
|---|---|---|---|
| **Supervisor** | Docs, milestone gate | — (own pass) | Runs the one gated review per milestone (see below); keeps `PROGRESS.md`/`PROJECT_CONTEXT.md`/`CLAUDE.md`/`document.txt` current. |
| **Backend/Algorithm** | `drizzle.config.ts`, `drizzle/`, `src/app/api/**`, `src/lib/engine/**`, `src/lib/db/**`, `src/lib/types/**` | [`src/lib/BACKEND_TASKS.md`](./src/lib/BACKEND_TASKS.md) | Schema, migrations, the pure formula modules, API routes. Never changes a formula's shape without updating `PROJECT_CONTEXT.md` §5 in the same step and flagging behavior changes to the user. |
| **Frontend/UI** | `src/app/**` (pages), `src/components/**` | [`src/app/FRONTEND_TASKS.md`](./src/app/FRONTEND_TASKS.md) | Pages/components per `PROJECT_CONTEXT.md`. Never invents an API shape — flag it instead of guessing. |
| **QA/Testing** | `src/tests/**` | [`src/tests/TEST_TASKS.md`](./src/tests/TEST_TASKS.md) | Unit (Vitest, node), component (Vitest+RTL, jsdom), e2e (Playwright) tests. Flags any `PROJECT_CONTEXT.md` requirement with no corresponding test rather than silently skipping it. |

These are hats the same session wears in sequence, not separate spawned agents — the only agents this file has you spawn are the milestone-gate review below and the one narrow exception right after it. Each role's checklist (`- [ ]` / `- [x]`) lives in its own `*_TASKS.md`, updated in the same step that finishes a task — never batched up later, never left for someone else to mark done.

**Exception — Design/UI-UX agent:** Frontend/UI may spawn a real Agent (not just wear the hat) for genuinely visual/aesthetic decisions — color-palette/contrast tuning (e.g. theme-derived text color), chart visual design, "does this look good" polish passes. Scope it to specific files/components, never a full-app redesign pass, and never for plumbing (schema, API wiring, state management) — that stays with the Frontend hat itself. The agent self-checks with the same `typecheck`/`lint`/`test` commands as any other step and leaves its diff uncommitted for the spawning session to review before committing. It still only participates in the one milestone-gate review below like everything else — it is not a second review layer.

---

## Context scoping (lazy loading) — read this before opening anything

When picking up work, read **only**, in order:

1. [`PROGRESS.md`](./PROGRESS.md) — current milestone and next action.
2. **Only the `*_TASKS.md` for your role's scope** (table above) — the granular checklist.
3. **Only the `PROJECT_CONTEXT.md` section(s) your specific task touches** — never the whole document unless the task is Milestone 4's own full-app review.

Do not load source code or docs for a different scope "to refresh context," and do not re-read a module you're not changing just because it's nearby — a green automated test suite is the trust signal for everything you're not actively touching. Cross-scope work (rare) is the one case where reading another scope's `*_TASKS.md`/section is justified — note why in the commit when it happens.

---

## Workflow: Milestone-Gated Review

**Why:** reviewing every small step (a file, a component, a route) with a full adversarial subagent burned tokens far out of proportion to the risk at that grain. Review is gated at the milestone boundary instead; everything smaller is self-checked with automated commands.

### Inside a milestone — no subagent review per step

- Execute the milestone's steps yourself, sequentially, ticking off `*_TASKS.md` as you go.
- After each step, self-verify with automated commands only: `npm run typecheck`, `npm run lint`, `npm run test`, and for UI work a direct smoke check (dev server + curl, or a quick manual pass). **Never spawn a review subagent for a single step.**
- Commit each step normally — commits stay granular for rollback safety even though review does not.

### At milestone completion — exactly one gated review

- Once every step in the milestone is implemented, self-verified green, and ticked off in its `*_TASKS.md`, spawn **one** Supervisor review agent — not before, not per-step.
- Scope it tightly: `git diff` from the milestone's first commit to now, plus the specific `PROJECT_CONTEXT.md` sections and schema/type files that diff touches. **Never instruct it to re-scan the whole codebase or re-review a prior, already-gated milestone.**
- **Re-check loop, max 2 iterations:** if the review finds real issues, fix them, then self-verify via automated commands first. Only spawn a second scoped review pass (diff of the fix only) if the fix needs a judgment call automated tests can't make. Stop after 2 iterations regardless; log anything still unresolved to `document.txt`.
- Commit the review's fixes, log the milestone's completion in `document.txt`, update `PROGRESS.md`'s status, then move to the next milestone.

---

## Definition of done (per step, self-checked — no agent needed for this)

1. Code matches `PROJECT_CONTEXT.md`; update the doc in the same step if a schema/formula/API contract changed.
2. The relevant `*_TASKS.md` line is ticked `- [x]` (or a new line added, for unplanned work).
3. New or changed logic has a test.
4. `typecheck` + `lint` + `test` all green.
5. Any newly-deferred idea goes to `document.txt`, not lost mid-conversation.
