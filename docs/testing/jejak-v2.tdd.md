# Jejak Pandawa v2 — 16 October 2026

## Outcome and content

Implemented the user's approved five-aspect correction. The complete classification and answer key are in `docs/JEJAK_PANDAWA_CLASSIFICATION.md`. Four revised questions receive new IDs (`yudhistira-04`, `sadewa-04/05/06`); eleven existing questions retain their text and IDs. The active bank has fifteen explicit aspect mappings; each shuffled game selects exactly two questions per aspect. It no longer infers a question's category from its display position or only its character.

The actual Phaser result screen now shows each run's five aspect scores with the existing Press Start 2P font. Mixed answers can produce 2/2, 0/2, 1/2, 2/2, 1/2. The server independently validates/scorers all ten answers rather than trusting client totals.

## Scoring, history and compatibility

`jejak_aspect_runs` stores complete answers, server-derived aspect scores, total, curriculum version and server timestamp. Its answer/score constraint prevents direct authenticated inserts from forging scores; row policies restrict insertion to the unlocked student owner and reads to that owner/admin. Browser roles have no update/delete rights and cannot supply `created_at` or curriculum version. Authorized account deletion still cascades results with its profile.

The new invoker `record_jejak_aspect_result_v2(uuid,jsonb)` retains a stable submission UUID across retries. Repeated payloads reuse the receipt; a changed payload or another student's ID collision is rejected. Deliberate new games append new runs. Existing progress locking/unlock rules and monotonic overall totals are preserved through the existing total RPC in the same transaction.

`admin_school_aspect_averages_v2(text)` computes each student's best score independently for each aspect across version 2 runs, then averages those student values per school. Frequent replays do not increase a student's weight. Version 1 totals/aspects never impute version 2 results, including legacy perfect totals. The Misi calculation and its full-cohort denominator remain identical to the old RPC. The UI checks `jejakVersion:2`, retains the paired purple/yellow bars, and explains version 2 coverage; missing results are shown as unavailable, not copied from the total or silently assigned zero.

Legacy RPCs, old answer keys and old progress columns remain intact for old clients. New v2 offline actions use `sikapandawa.jejakV2Queue.<account>`, while legacy actions remain in the original queue namespace. This separation prevents an already-open old tab's filter/write cycle from deleting new answers. New code reads/flushes both queues and can migrate staged v2 actions from the old key, writing the v2 copy first.

## TDD evidence

- Initial two content/scoring unit tests failed: no explicit aspect field and no per-answer scoring helper. The PostgreSQL suite failed because the v2 aggregate RPC did not exist. Both became GREEN after implementation.
- The independent reviewer identified a real cross-version queue loss scenario. Its regression failed with zero v2 RPC calls after an old-tab rewrite. The separate queue namespace makes all seven detailed-sync tests pass, including stable retry UUID, legacy RPC routing and owner-token isolation.
- No checkpoint commits were made because repository instructions require explicit commit approval, which was not requested. RED/GREEN evidence is preserved here instead.

## Local verification

| Check | Actual result |
| --- | --- |
| Entire Vitest suite | **266 tests, 39 files PASS** |
| Configured admin/auth/function coverage | Statements 91.84%, branches 80.41%, functions 87.15%, lines 94.52%; all configured 80% thresholds PASS |
| Existing Playwright suite | **25 tests PASS**, including explicit Jejak bar heights `[100,0,50,100,50]`, search/school independence, CRUD and monitoring |
| Actual Phaser Jejak browser flow | **1 additional test PASS**: ten shuffled questions played with A/D + Enter; captured ten unique answers; total 6; result labels match `[2,0,1,2,1]` |
| v2 PostgreSQL checks | **31 PASS**: all fifteen TS/SQL keys match; version separation; legacy perfect total cannot overwrite mixed v2 aspects; maxima/averages; UUID retries; malformed/repeated/retired questions; forged score/timestamp denial; student/admin/anon boundaries |
| Legacy aspect PostgreSQL checks | **27 PASS** |
| Parent monitoring PostgreSQL checks | **41 PASS** |
| Existing school PostgreSQL checks | **27 PASS** |
| Total isolated database checks | **126 PASS** |
| TypeScript / production build | PASS |
| Production dependency audit | `npm audit --omit=dev`: zero vulnerabilities |
| Diff whitespace | PASS, ordinary CRLF notices only |

The configured coverage list does not include every game module. Those modules have targeted unit tests, the isolated database suite and the actual Phaser browser test; no broader game coverage percentage is claimed. The gameplay test uses a fresh browser with explicit local Auth/Progress fixtures, so it does not create or alter production users/results.

The actual result screenshot was inspected at `test-results/jejak-v2-actual-Phaser-pla-2da49--independent-aspect-results-chromium/jejak-v2-aspect-result.png`: the five labels use the game's font, remain above the message panel and show the expected independent values. Existing browser tests inspect the responsive admin chart.

## Approved hosted activation

The user explicitly approved “Ya, terapkan migration Jejak versi 2”. The Supabase plugin applied `jejak_curriculum_v2`, hosted version **20261016071117**. Local file was CLI-generated, then renamed to match hosted history: `supabase/migrations/20261016071117_jejak_curriculum_v2.sql`.

Immediately before/after activation, all existing data counts and full-row fingerprints were identical:

| Existing data | Rows | MD5 |
| --- | ---: | --- |
| profiles | 28 | bc74e7eaed7649b67909404d10a7fb61 |
| player_progress | 28 | 5315a35af041535a947c6271a6c867fc |
| level_progress | 280 | 337610f6298c22e006110685e1f5f3f0 |
| parent_monitoring_observations | 3 | ec7c3dbb69addba248c38dff4c557d5d |

The new table begins with zero runs; no production test run or account was inserted. Read-only authenticated-admin queries return version 2, zero known results and unavailable means for all three actual schools, with **Misi values identical to the old RPC**. The same queries retain school sizes of 24, 1 and 2 students at activation. RLS is enabled, browser UPDATE/DELETE are denied and anonymous submit execution is revoked.

Advisors report no new structural security issue for the v2 objects. Existing notices remain for [intentional tables without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [leaked-password protection settings](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [multiple read policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies) and [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). Unrelated project/auth settings were not changed.

## Delivery and remaining operational limit

Frontend remains local as requested; no DomaiNesia upload, commit, push or PR was performed. Fresh production ZIP: `release/sikapandawa-jejak-v2-20261016.zip`, 40,626,375 bytes, 472 files. Root game, `admin/index.html` and `form/index.html` are present. Source trees, migrations, environment files and node_modules are excluded.

Refresh the local game and admin before testing. Complete all ten Jejak questions from an unlocked student account, allow sync, then refresh admin. Students must play the new curriculum to contribute v2 aspect results. Historic totals remain available; they cannot supply missing answers to revised questions. Public game users continue to receive the old frontend until an upload is requested.

## Self-evaluation

| Axis | Score | Evidence / limit |
| --- | --- | --- |
| Accuracy | 4/5 | Server/client answer keys match; actual Phaser input and live read aggregates are checked. No hosted student write was performed. |
| Completeness | 5/5 | Classification, revised content, per-aspect best scoring, history, queue compatibility, game output, admin graph and approved schema are delivered. |
| Clarity | 4/5 | UI distinguishes v2 coverage and old totals; curriculum content still represents a product classification rather than a validated research instrument. |
| Actionability | 4/5 | Local testing and ZIP are ready; historic pupils must replay before the new graph has results. |
| Conciseness | 4/5 | User-facing outcome can focus on classification and the replay step; implementation evidence remains here. |

Overall: 4.2/5. Highest-impact follow-up is an authorized user completing a real v2 run locally and confirming its admin chart. A later public rollout needs its own frontend upload. Self-check: the user can distinguish accurate v2 measurements from preserved historic totals and knows why replay is necessary.
