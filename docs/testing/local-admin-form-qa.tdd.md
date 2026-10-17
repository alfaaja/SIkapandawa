# Local admin and monitoring QA — 16 October 2026

## Result

Local functional checks PASS on **http://127.0.0.1:5173/admin/** and **http://127.0.0.1:5173/form/**. Refresh the old tabs to load the updated development client. The previous advice to switch ports is superseded by this repair.

The actual failure was the deployed admin-users allowlist: browser OPTIONS from port 5173 returned 403 without an allowed-origin header. Ports 8080/8081 returned 204. The same failure affected create, edit, password reset and deletion; a working login/read dashboard did not prove those account actions worked.

## Local fix and safety

`vite/config.dev.mjs` now loads the public development environment and exposes exactly `/__admin_api/admin-users`, forwarding to the configured project's fixed `/functions/v1/admin-users` endpoint with an already permitted loopback Origin. This is a development server route, not an open proxy. The admin client's DEV-only loopback fetch adapter rewrites only that project's exact account endpoint, preserving the request body, Authorization and idempotency header. Auth and database requests retain their original URLs.

No service credential is added. The remote function still authenticates each JWT and verifies the administrator. No remote CORS settings, function deployment, user account or monitoring row was changed by this QA run. The production bundle does not contain the development proxy path. The local production ZIP was refreshed for the contrast improvements.

## RED / GREEN

The initial local fetch regression target failed because its forwarding module did not exist. After implementation its two tests and the existing ten admin-client tests pass. A real Chromium smoke check using the real SDK sends all four account actions from an unauthenticated fresh context: each uses the local proxy and returns the expected readable 401; zero requests fail at CORS. This verifies routing and authorization denial, not a successful authenticated production mutation.

The first axe audit failed with serious color-contrast findings on the dark-header gold text, summary hints and account table headings. Text colors were adjusted while retaining the green/cream/gold design. Repeating the same twelve-state audit passes with zero violations.

No Git checkpoint commits were created: repository instructions require approval before commits, and none was requested. RED/GREEN evidence is preserved here instead.

## Verification

| Guarantee | Evidence | Result |
| --- | --- | --- |
| Local SDK forwards only the intended account endpoint and retains Request headers/body | `localAdminFetch.test.ts` | PASS |
| All four account actions can reach the protected hosted endpoint from port 5173 without CORS failure | `node scripts/check-local-admin-connection.mjs` | PASS; each safely returns 401 without login |
| Create, edit/rename, reset password, delete confirmation, refresh, search, filters, pagination and logout | 25 Playwright tests, using isolated DEV fixtures | PASS |
| Twelve monitoring occasions and a deliberate repeat leave thirteen records, with student and school charts | `e2e/monitoring.spec.ts` | PASS |
| A failed/uncertain save retries the same UUID; a deliberate repeat uses a new UUID; history refresh failure does not erase save success | `ParentPage.test.ts` | PASS |
| Double-submit and logout are blocked while a save is pending | `ParentPage.test.ts` | PASS |
| Monitoring RLS, append-only storage, N/A and equal student averages | `node scripts/test-monitoring-migration.mjs` | 41 PostgreSQL checks PASS |
| Entire unit suite | Vitest coverage run | 262 tests / 38 files PASS |
| Configured admin/auth/function coverage | Statements 91.77%, branches 80.26%, functions 86.85%, lines 94.52% | All configured 80% thresholds PASS |
| TypeScript and production build | `tsc --noEmit`, production Vite build | PASS |
| Whitespace | `git diff --check` | PASS, normal CRLF notices only |
| Independent review of proxy and fetch boundary | code-reviewer, read-only | No actionable blocker |

### Browser QA

`node scripts/local-ui-qa.mjs` checks admin login/dashboard and parent login/form at 375px, 768px and 1440px in twelve fresh contexts using seeded DEV credentials. It uses the official axe-core 4.14.0 package, stored only under ignored `release/qa-vendor/axe.min.js`. This audit adds no dependency or lockfile change. Raw results/screenshots: `release/local-qa/report.json` and the matching PNGs.

- No page errors or document-width overflow in all twelve cases.
- Axe reports zero WCAG A/AA violations after contrast fixes; this does not establish complete accessibility.
- Parent login keyboard sequence (username → password → submit) passes. Existing dialog/browser tests cover focus and actions.
- Observed local LCP: 104–224ms; CLS: 0–0.062. These are local scripted samples, not field measurements. Field INP was not measured.
- Desktop, tablet and phone screenshots were inspected. No committed visual baselines exist, so pixel-based visual regression is **INCONCLUSIVE**, not a claimed pass. Dark mode is not offered by these light-theme pages.

**Local functional verdict: PASS. Visual regression verdict: INCONCLUSIVE (no baseline).** This run does not authorize or perform a public deployment. Successful authenticated mutations against hosted production were intentionally not tested: all write journeys use isolated fixture data, and live connection probes are unauthenticated. The user can now test their desired real operations through the refreshed local admin.

## Self-evaluation

| Axis | Score | Evidence / improvement |
| --- | --- | --- |
| Accuracy | 4/5 | Routing is verified with the real SDK; successful hosted mutations are not claimed from an unauthenticated probe. |
| Completeness | 4/5 | All requested local admin/form journeys are covered with isolated fixtures; a production-authenticated write test remains outside this run. |
| Clarity | 4/5 | Separates local browser fixture results, live routing checks and visual baseline limits. |
| Actionability | 4/5 | Original port 5173 now works without moving tabs; a hard refresh is still needed for old browser state. |
| Conciseness | 4/5 | Short user-facing outcome; detailed commands and limitations are retained in this report. |

Overall: 4.0/5. Improvements by impact: retain a visual baseline for future regressions; use a dedicated staging Supabase project with seeded credentials for authenticated HTTP write journeys if requested. Self-check: the user can test locally without interpreting successful page loading as proof of all remote mutations.
