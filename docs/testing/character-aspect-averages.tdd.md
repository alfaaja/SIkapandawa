# Five character aspects — 15 October 2026

## Delivered behavior

The admin dashboard adds one combined five-aspect chart per school after the existing total/student charts, following the owner's supplied reference image. The x-axis lists all five aspects; each has a purple Misi bar and a yellow Jejak bar. One shared y-axis and the bar labels show 0–100%, normalizing Misi's six-point and Jejak's two-point scales. Accessible labels and hover titles retain original average points. The school selector scopes these charts, while table search, status and pagination do not. Admin accounts are excluded; students who have not played contribute zero. On phones, only the plot scrolls horizontally. The layout follow-up passed the updated unit and browser checks and TypeScript verification.

| Aspect | Misi levels | Jejak character |
| --- | --- | --- |
| Kejujuran | 1–2 | Yudhistira |
| Keberanian | 3–4 | Bima |
| Kesopanan | 5–6 | Arjuna |
| Kebijaksanaan | 7–8 | Nakula |
| Keadilan | 9–10 | Sadewa |

Jejak already draws two cards per character from its 15-card bank. The aspect classification follows the requested mission/character grouping. Original question wording and fine-grained tags remain unchanged. SQL's complete card key matches the runtime bank.

New games queue all ten card IDs and chosen baskets. The server validates distinct IDs, two cards per character, and baskets, then derives scores itself. Each aspect keeps its best recorded score independently, matching the mission's best-level scoring model. These aspect maxima can come from different runs and need not sum to the best total from one run. The existing Jejak total is preserved.

## Legacy data

Old Jejak stores only a best total, without answers. Totals 0 and 10 uniquely determine all five aspects; totals 1–9 do not. Unknown detail is never split evenly or silently counted as zero. Jejak averages use only students with known detail and show the denominator next to each school. New detailed runs make these students eligible. The UI explains this coverage difference from Misi's entire-cohort denominator.

Hosted verification found 28 accounts, 280 level rows, and 27 students across three actual schools. Kalibanteng has 24 students; 14 have inferable detail and 10 require a detailed replay. Its Misi averages, in the table's aspect order, are 3.375, 2.7083333333333335, 2.375, 2.2083333333333335, and 1.9583333333333333 out of 6. The 14 known Jejak scores average 1.5714285714285714 out of 2 in each aspect. This equality follows from the currently inferable 0/10 totals, not fabricated intermediate scores.

## TDD and validation

RED evidence: shared definitions/UI tests initially failed because the new modules did not exist; the PostgreSQL check failed because the aggregate RPC did not exist; offline queue tests failed because detailed submissions were absent. Session regression tests then demonstrated that A's queued actions continued after a switch to B, and hydration read through B's shared client.

GREEN evidence:

- 248 unit tests in 32 files pass. Coverage: 91.62% statements, 80.59% branches, 88.07% functions, 94.55% lines.
- 23 Playwright tests pass, covering existing admin behavior, five paired charts, search independence, distinct colors and phone/desktop overflow.
- `npm run test:aspect-db`: 24 isolated PostgreSQL checks pass, covering exact pair membership, zero/unplayed students, multiple admins and schools, legacy unknowns, authenticated/anonymous denial, malformed/duplicate cards, locked games, RLS and monotonic aspect scores.
- `npm run test:school-db`: all 27 existing school migration checks pass.
- TypeScript and production build pass. Production dependency audit reports zero vulnerabilities. No lint script exists. `git diff --check` passes.
- The code-reviewer found no scoring or aggregation blocker. Related pre-existing session races were fixed: each queue action and hydration read verifies the owner and pins the request's Authorization to that session snapshot. Failed actions remain queued. Regression tests cover both paths.

No checkpoint commits were created: repository instructions require approval for commits, and this request did not authorize committing. RED/GREEN evidence is preserved here instead.

## Hosted database and local build

The Supabase plugin applied migration `character_aspect_averages`, version `20261015084559`, in project `qbjkvbsdimxiglbhorre`. Local migration naming matches hosted history. The change adds a nullable validated aspect-score column and invoker RPCs, preserving current RLS/admin gates. Anonymous read and write RPC privileges remain revoked. Existing clients' total-only RPC remains compatible.

Before/after fingerprints are identical for existing progress fields: player hash `3376a2d00296394f915a3f76f8359482`; level hash `ad0d4cf44bbadc3a498b955952a460f1`. Account/level counts are unchanged and no hosted test user or detailed result was inserted. The authenticated admin aggregate was verified in a rolled-back read transaction.

Advisors retain pre-existing notices: [intentional tables without RLS policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [multiple permissive read policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies), and [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). No unrelated auth settings or policies were changed.

The user explicitly chose **Simpan lokal dulu** after being offered deployment. The frontend has NOT been uploaded to DomaiNesia. Local production package: `release/sikapandawa-five-aspects-20261015.zip`, with root `index.html`, `admin/` and `assets/`, refreshed after the combined-chart layout adjustment. It contains the actual project's public client configuration, without service-role credentials. The database is ready, but the online game will start collecting detail only after this game build is deployed.

## Self-evaluation

| Axis | Score | Evidence / practical limit |
| --- | --- | --- |
| Accuracy | 4/5 | Local write validation and live read aggregates verified; no production test-game write performed. |
| Completeness | 5/5 | Requested charts, classification, database readiness and local release delivered; publishing held at the user's request. |
| Clarity | 4/5 | Coverage and different score scales are explicit; some old detail remains unavailable. |
| Actionability | 4/5 | Upload-ready ZIP and repeatable tests provided; live collection awaits an authorized frontend rollout. |
| Conciseness | 4/5 | User-facing result kept short; verification details live in this document. |

Overall: 4.2/5. Next improvement when publishing is requested: verify the hosted charts and a permitted detailed-run submission end to end. Self-check: the user can distinguish the database change from the intentionally local frontend release.
