# Admin Sticky Header - TDD Evidence

## Source and user journey

No plan file was supplied. The journey was derived from the requested dashboard behavior:

> As an admin reviewing a long dashboard, I want the complete header to stay pinned at the top while I scroll, so the identity, refresh, password, and logout controls remain available.

## RED to GREEN report

| Behavior | RED evidence | GREEN evidence | Guarantee |
|---|---|---|---|
| Keep the full dashboard header visible during page scrolling | Checkpoint commit `8fcfa7d` adds the failing E2E reproducer for the formerly non-sticky header. | Checkpoint commit `0c8036d` applies the minimal CSS fix. Local Playwright geometry checks passed on 1366x768 and 390x844. | Scrolling to the bottom keeps the header at viewport top, keeps all actions visible, and introduces no horizontal page overflow. |

The test-first checkpoint is commit `8fcfa7d`. The minimal GREEN implementation and isolated desktop/mobile session cleanup are in commit `0c8036d`.

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | The dashboard header remains pinned at `top: 0` after a window scroll | `e2e/admin.spec.ts: keeps the dashboard header pinned while scrolling` | E2E/layout | PASS |
| 2 | Header actions remain visible after scrolling on desktop and phone | Same test | E2E/interaction | PASS |
| 3 | The sticky header causes no horizontal page overflow | Same test | E2E/responsive | PASS |
| 4 | Existing dashboard rendering and chart behavior still pass focused unit checks | `vitest run src/admin/ui/DashboardView.test.ts src/admin/ui/ProgressCharts.test.ts` | Unit/regression | PASS, 14 tests |

## Coverage and validation

- TypeScript: `tsc --noEmit` - PASS.
- Focused unit/regression tests: `vitest run src/admin/ui/DashboardView.test.ts src/admin/ui/ProgressCharts.test.ts` - PASS, 2 files and 14 tests.
- Production build: `vite build --config vite/config.prod.mjs` - PASS.
- Browser QA: local Vite on `http://127.0.0.1:8081`, Playwright geometry checks at 1366x768 and 390x844 - PASS.
- Full coverage was not rerun for this small CSS-only behavior change.

The header deliberately uses a stacking level below the existing toast and native modal layers. No visual-regression baseline exists, so screenshot-diff status remains inconclusive; responsive geometry and interaction behavior are covered directly by Playwright.
