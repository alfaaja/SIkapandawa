import { describe, expect, it } from 'vitest';

import migrationSql
    from '../../../supabase/migrations/20260815105354_relax_admin_delete_rate_limit.sql?raw';

describe('admin delete maintenance rate limit migration', () => {
    it('allows twelve confirmed deletes per rolling ten minutes without weakening other gates', () => {
        expect(migrationSql).toMatch(/when\s+'delete'\s+then\s+12/i);
        expect(migrationSql).toMatch(/when\s+'create'\s+then\s+5/i);
        expect(migrationSql).toMatch(/when\s+'reset_password'\s+then\s+5/i);
        expect(migrationSql).toMatch(/else\s+20/i);
        expect(migrationSql)
            .toMatch(/created_at\s+>=\s+now\(\)\s+-\s+interval\s+'10 minutes'/i);
        expect(migrationSql).toMatch(/private\.admin_users/i);
        expect(migrationSql).toMatch(/security\s+invoker/i);
        expect(migrationSql).toMatch(/pg_catalog\.pg_advisory_xact_lock/i);
    });
});
