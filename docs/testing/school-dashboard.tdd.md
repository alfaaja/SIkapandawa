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
| Full Playwright suite | 21 tests passed using Chromium Headless Shell; includes desktop/mobile layout, school selection, combined search and CRUD |
| Production dependency audit | No vulnerabilities in `npm audit --omit=dev` |
| Full dependency audit | Five existing development-tool vulnerabilities (four moderate, one high); no unrelated upgrades made |

The PostgreSQL check runs every historical migration in an ephemeral PGlite PostgreSQL instance with a minimal Auth schema and Supabase roles. It tests backfill, signup validation/normalization, unchanged progress snapshots, school counts, combined filters, pagination, old RPC call defaults, membership flags, and student/anonymous privilege boundaries. It does not replace a hosted GoTrue/PostgREST verification.

## Hosted rollout still required

No hosted database or site changes have been made. The installed Supabase plugin has not exposed database tools in this session. Docker is installed but its local engine is unavailable.

Apply `supabase/migrations/20261002122329_school_registration_dashboard.sql` to the confirmed hosted project first, then deploy the `admin-users` Edge Function, then the frontend build. New frontend RPC arguments require the migration; the new admin create-player payload requires the Edge Function update. The migration keeps old frontend callers working during this sequence.

After rollout, verify:

```sql
select school_name, count(*) as accounts
from public.profiles
group by school_name
order by school_name;
```

Existing accounts should all belong to `SDN Kalibanteng Kulon 01`. Register a test student in another school through the hosted game, confirm its profile school, and verify All shows two school groups while each selected school shows only its own accounts and student bars. Keep credentials and service-role keys out of chat and committed files.
