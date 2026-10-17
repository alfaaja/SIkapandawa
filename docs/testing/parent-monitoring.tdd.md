# Parent monitoring — 15 October 2026

## Delivered locally

`/form/` is a separate Vite HTML/DOM entry for parents using the existing student's username/password. The game and admin entries remain available. The parent Supabase client uses its own sessionStorage key and pins each RPC to the verified session owner. Logout is local to that client.

The supplied `BUKU MONITORING SISWA_PKM-PM SIKAPANDAWA.pdf` defines twelve flexible observation occasions, each containing all five aspects. PDF page 7 (printed page 6) defines scores 1–4 and N/A; PDF pages 12–17 contain the observation sheets; PDF page 21 explicitly excludes N/A from scores. The repeated “TITIK OBSERVASI 1” on the second sheet slot is treated as the obvious numbering typo; the application offers points 1–12.

The form records date/time, guardian, optional class, observed situation, five ratings, optional concrete behavior and parent reinforcement. A parent saves one occasion at a time and can revisit any point. After saving, the next missing point is selected. Repeated deliberate entries receive fresh UUIDs and are appended. A retry with the same UUID/payload returns the prior receipt; a changed payload under that UUID is rejected. A successful save remains successful if the separate history refresh fails.

The admin's school selector scopes monitoring independently of player search, status and pagination. Each school has one graph with twelve positions and five aspect lines, plus a numeric table showing averages and observation denominators. Each student's repeated scores are averaged first, then those student averages are averaged across the school so frequent submissions do not increase one student's weight. N/A/missing observations are omitted, never zero. Missing values break the line. The Monitoring account action shows the student's chart and paginated, immutable history.

## Database and authorization

Migration `supabase/migrations/20261015122926_parent_monitoring.sql` was generated using the installed Supabase CLI, rather than a hand-invented timestamp, then renamed to match the hosted migration version. The Supabase plugin's read-only preflight found no existing monitoring table in project `qbjkvbsdimxiglbhorre`.

The migration creates `parent_monitoring_observations` and four invoker RPCs: `parent_monitoring_context`, `submit_parent_monitoring`, `monitoring_history`, and `admin_monitoring_summary`. Constraints enforce twelve points, finite timestamps, bounded text and exact five-key scores of 1–4/null. Server timestamps cannot be supplied by the browser. RLS restricts writes to the student owner and reads to that student or an administrator. Anonymous RPC execution is revoked. Browser roles have no UPDATE/DELETE privilege. Existing authorized account deletion still cascades observations with its profile. No existing game-score or account rows are rewritten by this migration.

**Remote status: applied after explicit user approval.** The Supabase plugin successfully applied `parent_monitoring`, version `20261015122926`, to project `qbjkvbsdimxiglbhorre`. The local production form can now load monitoring context and submit through the real RPCs after student login. No hosted test student or monitoring result has been created.

Live verification used read-only transactions under the authenticated role for an existing student and administrator. Student context/history return zero completed points and zero records. The admin aggregate returns twelve points for each actual school (24, 1 and 2 students; 27 total), with zero participants and NULL averages throughout. An empty graph therefore represents missing observations rather than fabricated zero scores. RLS is enabled; authenticated UPDATE/DELETE, insertion of server `created_at`, and anonymous submit execution are denied by privileges.

Live non-admin aggregate and other-student history calls also raise insufficient-privilege errors as intended. The other student's ID was selected before switching to the restricted role; selecting it afterward correctly hides it under profile RLS and would pass NULL to the own-history default instead.

Before/after account and progress fingerprints are identical: 28 profiles (`fe002c486538bea2ac0e4e31bd9ca281`), 28 player progress rows (`fcb2c19b6101fbc0fe8f9d39b534ecdb`), 280 level rows (`b155a1bfc46885084977d8f6f1eb9333`). Monitoring starts at zero observations.

Supabase security advisors report no new monitoring-table security issue. Existing notices remain for [intentional tables without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Performance advisors retain [multiple read policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies) and [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), including the new history index on the currently empty monitoring table. The history index is deliberately retained for ordered pagination as data arrives. Unrelated authentication settings and existing policies were not changed.

The frontend remains local following the user's “Simpan lokal dulu” instruction. No DomaiNesia upload, commit, push or PR was performed. ZIP: `release/sikapandawa-monitoring-20261015.zip` (40,644,792 bytes; 474 entries), containing root game `index.html`, `admin/index.html`, `form/index.html`, assets and public configuration. No source tree, environment files, node_modules or database migration is inside the ZIP. Database activation is separate from extracting this ZIP.

## RED / GREEN and verification

Initial contract tests failed before the monitoring modules/RPC existed. The independent reviewer also identified a real async dialog race: closing a loading student dialog could be undone by a late response. A failing dismissal regression reproduced it; open-state and request-sequence guards fix it. Positive, error and dismissal paths now pass.

- 258 unit tests in 36 files pass. Configured admin/auth/function coverage passes all 80% thresholds: statements 91.73%, branches 80.27%, functions 86.75%, lines 94.49%. This coverage scope does not include every new parent/shared module; those modules also have targeted tests and browser coverage, rather than an asserted global parent coverage percentage.
- 25 Playwright browser tests pass. New coverage fills all twelve points, repeats point 1, checks thirteen surviving records, checks 2.5 as the repeated score mean, checks N/A, opens student history, verifies separate parent/admin sessions, rejects bad credentials, and checks a 390px phone viewport. Existing account CRUD, school filtering and game entry tests remain green.
- 41 PostgreSQL monitoring checks pass in isolated PGlite: append-only privileges, duplicate UUID retry, changed-payload rejection, malformed inputs, owner/admin/anonymous boundaries, twelve-point shape, equal student weighting, N/A denominators, pagination and unchanged game progress.
- Existing PostgreSQL suites pass: 27 school checks and 24 character-aspect checks (92 total across all three suites).
- TypeScript check and production build pass. `/`, `/admin/`, `/form/` each return HTTP 200 with module entries on preview port 5173.
- Production dependency audit reports zero vulnerabilities. No lint command is configured. `git diff --check` passes (only normal CRLF conversion notices).
- The code-reviewer re-reviewed the final diff and found no actionable blocker. Review was read-only. Subsequent hosted migration and read-only checks are documented above; browser login/write tests used isolated demo data rather than production student records.
- Desktop and 390px parent screenshots were inspected; labels, controls and history fit their panels. A graph screenshot was inspected after centering it below the sticky admin header. Test images live in ignored `test-results/`.

## Reproduce

Use the supported Node runtime on PATH, then run:

```powershell
npm run test:coverage
npm run test:monitoring-db
npm run test:school-db
npm run test:aspect-db
$env:PLAYWRIGHT_TEST_PORT='8092'
npm run test:e2e -- --workers=2
npx tsc --noEmit
npm run build-nolog
npm audit --omit=dev
```

The test-only backend is dynamically available only in development at `/form/?mockMonitoring=1` and `/admin/?mockAdmin=1`. Production builds remove this branch. Demo data remains local and is not evidence of hosted integration.

## Self-evaluation

Local implementation and verification are complete; the new hosted schema has been activated with approval. Frontend hosting remains intentionally unchanged.

| Axis | Score | Evidence / improvement |
| --- | --- | --- |
| Accuracy | 4/5 | 258 unit tests, 25 browser flows and 92 PostgreSQL checks pass; hosted context, history, aggregates and grants are verified, while hosted student writes were not exercised. |
| Completeness | 5/5 | Form, repeated history, student detail, school graph and approved database activation are delivered; publishing remains local at the user's request. |
| Clarity | 4/5 | Twelve occasions, five aspects, 1–4 scale, N/A exclusion and equal student weights are explicit; the form is necessarily long on a phone. |
| Actionability | 4/5 | Local URLs, checked ZIP and real database are ready; public access still requires the intentionally deferred hosting upload. |
| Conciseness | 4/5 | Main UI uses a short form and optional history/table details; detailed evidence stays in this report. |

Overall: 4.2/5. At the next authorized rollout, verify the hosted form and perform a parent submission with a permitted real/test student. Self-check: the user can distinguish the now-active database from the intentionally local frontend and the absence of existing monitoring observations.

## Local development configuration correction — 16 October 2026

The process already listening on port 5173 was a Vite development server, not a production preview. HTTP 200 alone had masked missing development Supabase configuration: `.env.production.local` is not loaded in development, so both real login surfaces failed before rendering their forms. Added ignored `.env.development.local` containing only the two existing public `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` variables; no credentials or remote settings were changed. Vite reloaded the environment automatically.

Verified both real `/form/` and `/admin/` pages with a fresh headless Chromium context at port 5173: the expected login buttons are visible, configuration errors are absent and no page errors occur. Screenshots were inspected and saved under ignored `release/local-parent-login.png` and `release/local-admin-login.png`. This checks the real configuration/render path, without signing in or inserting hosted records. The production ZIP is unchanged because production configuration was already present.

### Account creation requires an approved local origin

**Superseded later on 16 October:** the development proxy fix and full admin/form QA in `docs/testing/local-admin-form-qa.tdd.md` now allow port 5173 for account mutations. The following paragraph preserves the original diagnosis.

The user's subsequent Add player attempt at port 5173 failed at CORS preflight, before any account operation reached the handler. Direct preflight verification returned 403 without an allowed-origin header for `http://127.0.0.1:5173`, while ports 8080 and 8081 returned 204 and the matching allowed origin. Read-only database checks confirmed zero `arya` profiles and zero recent account operations for that username.

Port 8080 belongs to another process, so a separate development server was started at **http://127.0.0.1:8081/**, already allowed by the deployed `admin-users` function. Use `/admin/` and `/form/` on this port for the real local workflow. A browser check verifies both login surfaces and an unauthenticated function request returns its expected readable 401, rather than a CORS failure. No account was created, password read, remote function deployed or CORS setting broadened. The user must log in on the new origin and submit their desired account themselves. The old port 5173 can render pages but remains unsuitable for remote account mutations under the current allowlist.
