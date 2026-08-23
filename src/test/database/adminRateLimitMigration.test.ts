import { describe, expect, it } from 'vitest';

import migrationSql
    from '../../../supabase/migrations/20260815105354_relax_admin_delete_rate_limit.sql?raw';

function beginOperationDefinition(): string {
    const definition = migrationSql.match(
        /create or replace function public\.admin_begin_account_operation\([\s\S]*?\n\$\$;/i,
    )?.[0];
    if (!definition) throw new Error('admin_begin_account_operation definition is missing');
    return definition;
}

describe('admin account-operation rate-limit migration contract', () => {
    const definition = beginOperationDefinition();

    it('allows a maintenance-sized batch of 12 deletes per rolling ten minutes', () => {
        expect(definition).toMatch(/when\s+'delete'\s+then\s+12\b/i);
        expect(definition).toMatch(/created_at\s*>=\s*now\(\)\s*-\s*interval\s+'10 minutes'/i);
        expect(definition).toMatch(/if\s+recent_count\s*>=\s*action_limit\s+then/i);
    });

    it('keeps the create, reset-password, and update limits unchanged', () => {
        expect(definition).toMatch(/when\s+'create'\s+then\s+5\b/i);
        expect(definition).toMatch(/when\s+'reset_password'\s+then\s+5\b/i);
        expect(definition).toMatch(/else\s+20\b/i);
    });

    it('counts every recent attempt regardless of terminal outcome', () => {
        const countQuery = definition.match(
            /select\s+count\(\*\)::integer\s+into\s+recent_count[\s\S]*?if\s+recent_count\s*>=\s*action_limit/i,
        )?.[0];

        expect(countQuery).toBeDefined();
        expect(countQuery).not.toMatch(/\bstatus\s*(?:=|in\b)/i);
    });
});
