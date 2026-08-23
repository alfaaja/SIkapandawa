import { describe, expect, it } from 'vitest';

import { safeMutationFailure }
    from '../../../supabase/functions/admin-users/mutationFailure';

describe('admin mutation failure mapping', () => {
    it('maps uniqueness failures without leaking backend details', () => {
        const failure = safeMutationFailure(
            new Error('duplicate key violates unique constraint profiles_username_key'),
        );

        expect(failure.status).toBe(409);
        expect(failure.message).toBe('Username sudah digunakan');
        expect(failure.message).not.toContain('profiles_username_key');
    });

    it('maps optimistic concurrency failures to a retryable conflict', () => {
        const failure = safeMutationFailure(
            new Error('Profile changed; refresh and retry'),
        );

        expect(failure.status).toBe(409);
        expect(failure.message).toBe('Data akun telah berubah. Muat ulang dan coba lagi');
    });

    it('maps missing accounts and keeps unknown failures generic', () => {
        expect(safeMutationFailure(new Error('no rows found')).status).toBe(404);

        const unknown = safeMutationFailure(new Error('database host secret detail'));
        expect(unknown.status).toBe(503);
        expect(unknown.message).toBe('Layanan akun sementara tidak tersedia');
        expect(unknown.message).not.toContain('secret detail');
    });
});
