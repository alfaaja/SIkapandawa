import { describe, expect, it } from 'vitest';

import migrationSql
    from '../../../supabase/migrations/20260823113402_admin_username_rename.sql?raw';

function functionDefinition(name: string): string {
    const definition = migrationSql.match(
        new RegExp(
            `create\\s+or\\s+replace\\s+function\\s+${name}\\([\\s\\S]*?\\n\\$\\$;`,
            'i',
        ),
    )?.[0];

    if (!definition) throw new Error(`${name} definition is missing`);
    return definition;
}

describe('admin username rename migration contract', () => {
    it('extends the operation ledger and preserves all per-action limits', () => {
        expect(migrationSql).toMatch(
            /check\s*\(\s*action\s+in\s*\([^)]*'rename_username'[^)]*\)\s*\)/i,
        );

        const beginOperation = functionDefinition(
            'public\\.admin_begin_account_operation',
        );
        expect(beginOperation).toMatch(
            /action\s+not\s+in\s*\([^)]*'rename_username'[^)]*\)/i,
        );
        expect(beginOperation).toMatch(/when\s+'rename_username'\s+then\s+5\b/i);
        expect(beginOperation).toMatch(/when\s+'delete'\s+then\s+12\b/i);
        expect(beginOperation).toMatch(/when\s+'create'\s+then\s+5\b/i);
        expect(beginOperation).toMatch(/when\s+'reset_password'\s+then\s+5\b/i);
        expect(beginOperation).toMatch(/else\s+20\b/i);
        expect(beginOperation).toMatch(
            /created_at\s*>=\s*now\(\)\s*-\s*interval\s+'10 minutes'/i,
        );
    });

    it('keeps profile identity immutable except for the scoped service operation', () => {
        const guard = functionDefinition('private\\.guard_profile_identity');
        expect(guard).toMatch(/current_user\s*=\s*'service_role'/i);
        expect(guard).toMatch(
            /coalesce\(\s*current_setting\(\s*'app\.admin_identity_rename'\s*,\s*true\s*\)\s*,\s*''\s*\)\s*=\s*'on'/i,
        );
        expect(guard).toMatch(/new\.id\s+is\s+distinct\s+from\s+old\.id/i);
        expect(guard).toMatch(/Profile identity fields are immutable/i);
    });

    it('provides a locked, validated, optimistic service-only identity update', () => {
        const updateIdentity = functionDefinition(
            'public\\.admin_service_update_profile_identity',
        );
        expect(updateIdentity).toMatch(/security\s+invoker/i);
        expect(updateIdentity).toMatch(/set\s+search_path\s*=\s*''/i);
        expect(updateIdentity).toMatch(/current_user\s*<>\s*'service_role'/i);
        expect(updateIdentity).toMatch(/pg_catalog\.pg_advisory_xact_lock/i);
        expect(updateIdentity).toMatch(/private\.admin_users/i);
        expect(updateIdentity).toMatch(
            /normalized_expected_username\s+text\s*:=\s*lower\(btrim\(coalesce\(expected_username,/i,
        );
        expect(updateIdentity).toMatch(
            /normalized_new_username\s+text\s*:=\s*lower\(btrim\(coalesce\(new_username,/i,
        );
        expect(updateIdentity).toMatch(/'\^\[a-z0-9\._-\]\{3,20\}\$'/i);
        expect(updateIdentity).toMatch(
            /trimmed_display_name\s+text\s*:=\s*btrim\(coalesce\(new_display_name,/i,
        );
        expect(updateIdentity).toMatch(
            /char_length\(trimmed_display_name\)\s+not\s+between\s+2\s+and\s+24/i,
        );
        expect(updateIdentity).toMatch(
            /set_config\(\s*'app\.admin_identity_rename'\s*,\s*'on'\s*,\s*true\s*\)/i,
        );
        expect(updateIdentity).toMatch(/update\s+public\.profiles/i);
        expect(updateIdentity).toMatch(/normalized_username\s*=/i);
        expect(updateIdentity).not.toMatch(/player_progress|level_progress/i);
    });

    it('does not expose the privileged function or direct profile updates to browser roles', () => {
        expect(migrationSql).toMatch(
            /revoke\s+all\s+on\s+function\s+public\.admin_service_update_profile_identity\(uuid,\s*text,\s*text,\s*text\)\s+from\s+public,\s*anon,\s*authenticated/i,
        );
        expect(migrationSql).toMatch(
            /grant\s+execute\s+on\s+function\s+public\.admin_service_update_profile_identity\(uuid,\s*text,\s*text,\s*text\)\s+to\s+service_role/i,
        );
        expect(migrationSql).not.toMatch(
            /grant\s+update\s+on\s+(?:table\s+)?public\.profiles\s+to\s+(?:anon|authenticated)/i,
        );
    });
});
