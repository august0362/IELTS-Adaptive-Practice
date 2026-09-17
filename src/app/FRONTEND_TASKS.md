# Frontend & UI Pages — Task List

> Scope: `src/app/**` (pages, layout) + `src/components/**`. Technical contracts (API shapes this layer consumes) live in `PROJECT_CONTEXT.md` §6 — this file only tracks *what's done vs. pending*. Read `PROGRESS.md` at the repo root first for overall status before this file.

## Done

- [x] App shell & nav — `layout.tsx`, `components/layout/Nav.tsx` (active-link highlighting)
- [x] Spinner page — `page.tsx` (Server Component data fetch) + `components/spinner/*` (cascading roll animation, per-card probability display, recent-rolls list)
- [x] Journal page — `journal/page.tsx` + `components/journal/*` (note CRUD, `#tag` auto-extraction from content, tag-chip filter)
- [x] Cambridge test tracking — `components/prediction/CambridgeTracker.tsx` + `CambridgeRow.tsx` (add/edit/delete, 5-most-recent + "Xem tất cả"/"Thu gọn")
- [x] Prediction Dashboard — `components/prediction/PredictionCards.tsx`, `RoundingModeToggle.tsx`, `RatioSliders.tsx`, `FrequencyChart.tsx`, composed by `PredictionPageClient.tsx`
- [x] Dataviz-compliant frequency chart — validated categorical palette (light + dark), direct value labels, hover tooltip
- [x] Fix: `export const dynamic = "force-dynamic"` on all 3 pages (a live-DB Server Component must not be statically prerendered by `next build` — see `PROJECT_CONTEXT.md` §3)
- [x] Standing pattern: initial data via Server Component props, never a client-side `useEffect` fetch-on-mount (this project's `eslint-plugin-react-hooks` flags any `setState` reachable from an effect)
- [x] Theme system (Milestone 4 prep, before Step 1's review) — `src/lib/theme.ts` (19 themes sourced from `src/theme/*.png`, `computeThemeRoles()`), `components/theme/ThemeProvider.tsx` + `ThemePicker.tsx`, `/settings` page, `Cài đặt` nav link. Swept every component off hardcoded `bg-white/60`/`border-black/10`/`bg-foreground text-background` onto theme-aware `bg-surface`/`border-border`/`bg-primary`/`text-primary-foreground` utilities so the whole app repaints on theme change; kept destructive/status colors (delete=red, spinner cycling/selected=blue/emerald) fixed on purpose. Sweep verified clean by Milestone 4 Step 1's review (no remaining hardcoded color classes found).
- [x] Milestone 4 Step 1 fix: `computeThemeRoles`'s `primaryForeground` text-color pick was a flat `relativeLuminance > 0.5` split, which failed WCAG AA contrast on 7 of the 19 themes (3 of those below even the AA-large/UI 3:1 floor) — fixed to pick whichever of `#111111`/`#ffffff` has the higher measured contrast against `primary`. See `document.txt`'s "Milestone 4, Step 1" entry.

## Backlog / deferred (see `document.txt` for full context on each)

- [ ] Adjustable `baseRatio` UI for Writing (Task 1/2) and Listening (Block A/B) — currently only Speaking/Reading are exposed, per the original spec's scope
- [ ] Dedicated Config UI for engine constants (`decay_exponent`, `weekly_threshold_days`, etc.) — currently only reachable via the API/DB directly
- [ ] Milestone 4's `USER_GUIDE.md` may surface further UX polish items once written

## Adding a new task

New frontend-scoped work (a new page, a new component, a UI-facing bug fix) gets a line added here in the same step that implements it, not batched up later.
