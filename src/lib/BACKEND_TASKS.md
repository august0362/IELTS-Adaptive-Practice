# Backend & Math Engine — Task List

> Scope: `src/lib/**` (engine, db, types) + `src/app/api/**`. Technical contracts (schema, formulas, API shapes) live in `PROJECT_CONTEXT.md` — this file only tracks *what's done vs. pending*, checklist-style. Read `PROGRESS.md` at the repo root first for overall status before this file.

## Done

- [x] Tech pivot: Prisma → Drizzle ORM + better-sqlite3 (`PROJECT_CONTEXT.md` §2.1)
- [x] Drizzle schema — 7 tables (`db/schema.ts`)
- [x] DB client singleton (`db/client.ts`)
- [x] Seed data — 4 skills, 8 parts, 6 config defaults (`db/seed.ts`'s `seedDatabase()`, reused by both `db/seedCli.ts` and the e2e test setup)
- [x] Shared query helpers (`db/queries.ts`): `getSkillsWithParts`, `getAllNotes`, `getCambridgeResults`, `getRecentRollHistory`, `getPredictionData`
- [x] `db/configHelpers.ts` — typed `EngineConfig` reader (works both inside a sync `db.transaction()` and from a plain route handler)
- [x] `api/../requestJson.ts` — safe JSON body parsing shared across mutating routes
- [x] Formula 1 — `engine/weightedRandom.ts`
- [x] Formula 2 — `engine/weeklyConstraint.ts`
- [x] Formula 3 — `engine/bandPrediction.ts` (+ `overall_prediction_rounding_mode` toggle)
- [x] `engine/ieltsRounding.ts` — official IELTS overall-band rounding rule
- [x] `engine/countSoftReset.ts` — counter rescale safeguard
- [x] `POST /api/roll` — single synchronous transaction (Formula 2 → Formula 1 per skill → counters → soft-reset)
- [x] `GET /api/skills`
- [x] `PATCH /api/skills/parts/:id/ratio`
- [x] `GET /api/history`
- [x] `GET/POST /api/notes`, `PATCH/DELETE /api/notes/:id`
- [x] `GET/POST /api/cambridge`, `PATCH/DELETE /api/cambridge/:id`
- [x] `GET /api/prediction` (gained `practiceCount30dPerSkill` in Milestone 2 Step 5)
- [x] `GET/PATCH /api/config`

## Backlog / deferred (see `document.txt` for full context on each)

- [ ] Band Prediction v2 — OLS linear regression per skill, replacing the flat 30-test mean
- [ ] Weekly-minimum-appearance safety net at the Part/Block level (currently skill-level only)
- [ ] Tune `count_soft_reset_threshold` once real usage data exists
- [ ] Auth / multi-user support (indefinitely deferred — local-only app)
- [ ] Cloud deployment config (indefinitely deferred)

## Adding a new task

New backend-scoped work (a new API route, a new engine module, a schema change) gets a line added under a task's relevant section here — done in the same step that implements it, not batched up later.
