# School registration and dashboard — verification

## Behavior

- Registration in the game and admin create-player dialog captures a required school name. Both use the shared normalizer and send Auth metadata to the signup trigger.
- `profiles.school_name` is non-null. The migration assigns every pre-existing profile to `SDN Kalibanteng Kulon 01` without changing progress or level scores.
- School names collapse whitespace and case to prevent separate groups for spelling variants. The existing school keeps the requested display capitalization.
- The admin dropdown starts at `All`. School selection scopes summary counts, accounts, search/status filters, pagination, and charts. Changing schools resets pagination; the full school choice list survives selection.
- `All` shows two averages per school: Misi /30 and Jejak /10. All students, including zero scores, enter the denominator. Every server-marked admin is excluded. Heights show percentage of each game's maximum; labels show raw averages with up to two decimal places.
- Selecting a school restores the existing per-student Misi and Jejak charts. Search/status filters only narrow the table, preserving the complete school chart population.

## RED and GREEN evidence

The test-first checkpoint is `c20e3f8` (`test(schools): capture RED for registration, filtering and school averages`). Initial registration/filter/average tests failed before implementation.

An additional multiple-admin regression failed with `20/30` and three pupils; the correction produces `15/30` and two pupils. Database tests verify that only an authorized admin can read membership flags and that both admin profiles are marked.

| Check | Result |
| --- | --- |
| Full Vitest suite | 29 files, 238 tests passed |
| Coverage | Statements 92.77%, branches 81.31%, functions 91.73%, lines 95.17%; all configured 80% thresholds passed |
| TypeScript | `tsc --noEmit` passed |
| Production build | Vite production build passed |
| Actual PostgreSQL migrations | `npm run test:school-db`: 27 checks passed |
| Browser inspection | Local game registration and admin All/selected-school views verified in the in-app browser |
| Full Playwright suite | 22 tests passed using Chromium Headless Shell; includes desktop/mobile layout, school selection, combined search, CRUD and schools appearing only after registration |
| Production dependency audit | No vulnerabilities in `npm audit --omit=dev` |
| Full dependency audit | Five existing development-tool vulnerabilities (four moderate, one high); no unrelated upgrades made |

The PostgreSQL check runs every historical migration in an ephemeral PGlite PostgreSQL instance with a minimal Auth schema and Supabase roles. It tests backfill, signup validation/normalization, unchanged progress snapshots, school counts, combined filters, pagination, old RPC call defaults, membership flags, and student/anonymous privilege boundaries. It does not replace a hosted GoTrue/PostgREST verification.

## Hosted rollout — 2 October 2026

The owner requested hosted database synchronization and separately approved deploying `admin-users`. The Supabase plugin applied `school_registration_dashboard` to project `qbjkvbsdimxiglbhorre`, recorded as migration `20261002140620`. The local migration filename matches the hosted version. Edge Function `admin-users` version 7 is ACTIVE with JWT verification enabled. The updated production frontend was published through the owner's connected DomaiNesia cPanel to `/home/sikapand/public_html`.

Hosted verification:

- All 26 profiles have `school_name = 'SDN Kalibanteng Kulon 01'`; no missing school names and no second school.
- 26 player-progress rows and 260 level-progress rows remain. Their before/after hashes are identical, confirming unchanged progress and scores.
- Authenticated admin RPCs return only the one real school. All and selected-school summaries both report 26 accounts; a nonexistent second school returns zero accounts.
- The chart population is 25 students, excluding the admin. Actual mean scores are Misi 12.12/30 and Jejak 7.68/10.
- Old no-school RPC calls still work. Anonymous summary access remains revoked. The signup trigger stores school metadata and the column is NOT NULL.
- Deployed Edge Function smoke checks return 401 for unauthenticated POST and 204 for allowed-origin CORS preflight.
- Default demo data now uses only the existing school. Multiple-school tests create a new school account explicitly inside the disposable test backend; no new school or test account was added to the hosted database.
- Registration form spacing increased by 13 logical pixels. The group of fields moves up while the button stays inside the panel.

The production build is configured for the actual project using a publishable key in ignored `.env.production.local`. No service-role credential is included. Local Docker remains unavailable; PostgreSQL verification uses the isolated PGlite instance.

Advisors retain existing notices for intentionally private/service-only tables [without RLS policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [multiple read policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies), and [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), including the newly created school index before normal traffic. No auth settings or unrelated policies were changed.

Production frontend verification:

- Before publishing, cPanel created `/home/sikapand/sikapandawa-backup-before-schools-20261002.zip` (39.3 MB), outside the public document root, containing the previous admin, assets, favicon, index and stylesheet. The new release ZIP also stays outside the public document root. Existing hosting configuration and unrelated files were preserved.
- The logged-in online admin session restored successfully. Its dropdown defaults to All and contains only All and SDN Kalibanteng Kulon 01. All displays two bars with actual averages 12.12/30 and 7.68/10 for 25 students. Selecting the school displays the individual student charts; the filter was returned to All.
- The online game registration screen includes the school field in the existing font and the additional gap before Daftar. No hosted test account was created.
- Both browser tabs reported no console errors. Screenshots were saved as `admin-schools-live.png` and `game-registration-school-live.png` in the task's visualization directory.
- The code-reviewer agent reviewed the follow-up source diff and found no actionable bugs or regressions.

Database verification query:

```sql
select school_name, count(*) as accounts
from public.profiles
group by school_name
order by school_name;
```

New schools appear only when actual registrations provide those school names. Keep credentials and service-role keys out of chat and committed files.
