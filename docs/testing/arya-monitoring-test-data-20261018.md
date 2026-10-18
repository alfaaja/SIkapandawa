# Arya monitoring comparison test data — 18 October 2026

User authorized synthetic monitoring examples in their own Arya / UNIMUS testing account. All 48 appended records contain DATA UJI labels and explicit synthetic provenance. No actual teacher is attributed: submitted_by is null.

| Period | Records | Expected classification on all five aspects | Verified MAE | Exact agreement |
| --- | --- | --- | --- | --- |
| 9001 | 12 parent + 12 teacher | no_repeated_large_gap | 0 | 100% |
| 9002 | 12 parent + 12 teacher | review / Perlu klarifikasi | 2.5 | 0% |

Verification: invoked the deployed admin_monitoring_comparison RPC under authenticated master access, receiving 60 paired cells per period. Evaluated these numeric test results with the actual src/shared/monitoringComparison.ts classifier: all ten aspect assertions passed, with 12 paired points per aspect. Period 9002 has 12 large-gap points per aspect. This classification indicates disagreement requiring clarification; it does not establish manipulation.

Before/after aggregate digests matched for player_progress, level_progress, jejak_aspect_runs, and all monitoring records outside these two test periods. Account count remained 30; the four previous monitoring records remained unchanged. No frontend deployment or rebuild was needed.

To inspect: select period 9001 or 9002 in the admin Monitoring tab and apply it, then open Arya's Monitoring detail from the student list and find the parent–teacher comparison. Test records can affect school charts while their test period is selected; use period 1 for the existing observations.

Self-evaluation: accuracy 4/5 (live RPC and application evaluator verified; browser display not rechecked); completeness 4/5 (both scenarios seeded and prior data verified; no UI screenshot); clarity 5/5 (periods and statuses explicit); actionability 4/5 (navigation supplied; view not opened automatically); conciseness 4/5 (separate technical evidence retained here). Overall 4.2/5. Main improvement: confirm the visual result in the user's browser. The assessment reflects the verified database and classifier scope.
