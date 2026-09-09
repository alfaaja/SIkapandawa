# Admin Fixed Progress Charts — TDD Evidence

## Source and user journey

No plan file was supplied. The journey was derived from the requested admin-dashboard revision:

> As an admin preparing a screenshot, I want every student bar visible without horizontal scrolling and a compact label mode, so the two charts fit in one fixed dashboard view.

## RED → GREEN report

| Behavior | RED evidence | GREEN evidence | Guarantee |
|---|---|---|---|
| Toggle full student names to two-letter labels | `vitest run src/admin/ui/ProgressCharts.test.ts` — 1 failed because the mode button did not exist | Same target — 5 passed | The button toggles `Fahmi Nuriya` to `FA`, handles an initial such as `M. Dika Saputra` as `MD`, toggles back, and preserves the full accessible name. |
| Fit every chart column without horizontal scrolling | `playwright test e2e/admin.spec.ts --grep "whole-cohort score charts"` — failed with `fixedCharts: false` | Same target — 1 passed | Both normal and compact chart modes keep every chart viewport at `scrollWidth <= clientWidth`, and table filtering does not alter the cohort charts. |
| Keep maximum-score labels inside the chart | `npm.cmd run test:e2e -- --grep "shows two whole-cohort score charts"` — failed because all five `10/10` labels were clipped above the chart | Same target — 1 passed | A dedicated label gutter keeps maximum labels such as `10/10` and `30/30` visible while preserving proportional bar heights. |

The original test-first checkpoint is commit `b8ddd2e`, with GREEN implementation in `dfd5cdf` and dense-label refinement in `509fbc4`. The maximum-label regression checkpoint is commit `4b73a6f`, with its GREEN fix in `5ce7926`.

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | Two charts retain registration order and exclude the admin | `src/admin/ui/ProgressCharts.test.ts` | Unit | PASS |
| 2 | Score values remain inside their declared 0–maximum range | `src/admin/ui/ProgressCharts.test.ts` | Unit | PASS |
| 3 | Compact mode converts visible names to two-letter labels and toggles back | `src/admin/ui/ProgressCharts.test.ts` | Unit/DOM | PASS |
| 4 | Full names remain in accessible labels and untrusted profile text is not parsed as HTML | `src/admin/ui/ProgressCharts.test.ts` | Unit/security | PASS |
| 5 | Normal and compact charts have no page or internal horizontal overflow at 1366 px | `e2e/admin.spec.ts` | E2E | PASS |
| 6 | Maximum Jejak labels remain fully inside the visible chart bounds | `e2e/admin.spec.ts` | E2E/layout | PASS |
| 7 | The full admin and game browser flows remain functional | `playwright test` | E2E | 18 PASS |

## Coverage and validation

- TypeScript: `tsc --noEmit` — PASS.
- Production build: `vite build --config vite/config.prod.mjs` — PASS.
- Full unit/integration suite: 26 files, 220 tests — PASS.
- Full E2E suite: 18 tests — PASS.
- Coverage: statements 92.61%, branches 81.02%, functions 91.73%, lines 94.92%.
- A local 1366 px screenshot inspection covered both full-name and compact modes; the temporary inspection images were removed after review.

Known constraint: labels become increasingly small as the cohort grows. Cohorts over 30 students automatically use a denser vertical-label treatment to preserve the no-scroll guarantee.
