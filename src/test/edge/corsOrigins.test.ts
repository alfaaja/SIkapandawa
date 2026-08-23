import { describe, expect, it } from 'vitest';

import { resolveAdminAllowedOrigins }
    from '../../../supabase/functions/admin-users/corsOrigins';

describe('admin Edge Function CORS origins', () => {
    it('allows the production domains and local preview by default', () => {
        const origins = resolveAdminAllowedOrigins();

        expect(origins).toContain('https://sikapandawa.com');
        expect(origins).toContain('https://www.sikapandawa.com');
        expect(origins).toContain('http://127.0.0.1:8081');
        expect(origins).not.toContain('*');
    });

    it('uses a trimmed explicit configuration when supplied', () => {
        expect(resolveAdminAllowedOrigins(
            ' https://admin.example.test, https://school.example.test ,, ',
        )).toEqual([
            'https://admin.example.test',
            'https://school.example.test',
        ]);
    });
});
