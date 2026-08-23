import { describe, expect, it, vi } from 'vitest';
import { executeUsernameRename } from '../../../supabase/functions/admin-users/usernameRename';

const USER_ID = '987e6543-e21b-42d3-a456-426614174000';

function input() {
    return {
        userId: USER_ID,
        currentEmail: 'old-internal@example.invalid',
        currentMetadata: { display_name: 'Budi', username: 'budi' },
        currentUsername: 'budi',
        newEmail: 'new-internal@example.invalid',
        newMetadata: { display_name: 'Budi Baru', username: 'budi.baru' },
        newUsername: 'budi.baru',
        newDisplayName: 'Budi Baru'
    };
}

function dependencies(events: string[] = []) {
    return {
        revokeSessions: vi.fn(async () => { events.push('revoke'); }),
        updateAuthIdentity: vi.fn(async (_userId, identity: { email: string }) => {
            events.push(identity.email.includes('new-') ? 'auth:new' : 'auth:rollback');
        }),
        updateProfileIdentity: vi.fn(async () => { events.push('profile'); })
    };
}

describe('executeUsernameRename', () => {
    it('revokes sessions before changing Auth and profile identity', async () => {
        const events: string[] = [];
        const deps = dependencies(events);

        await expect(executeUsernameRename(input(), deps)).resolves.toEqual({ userId: USER_ID });

        expect(events).toEqual(['revoke', 'auth:new', 'profile']);
        expect(deps.updateAuthIdentity).toHaveBeenCalledWith(USER_ID, {
            email: 'new-internal@example.invalid',
            emailConfirm: true,
            userMetadata: { display_name: 'Budi Baru', username: 'budi.baru' }
        });
        expect(deps.updateProfileIdentity).toHaveBeenCalledWith({
            userId: USER_ID,
            expectedUsername: 'budi',
            newUsername: 'budi.baru',
            newDisplayName: 'Budi Baru'
        });
    });

    it('does not touch the profile when the Auth identity update fails', async () => {
        const deps = dependencies();
        const failure = new Error('auth update failed');
        deps.updateAuthIdentity.mockRejectedValueOnce(failure);

        await expect(executeUsernameRename(input(), deps)).rejects.toBe(failure);

        expect(deps.updateAuthIdentity).toHaveBeenCalledTimes(1);
        expect(deps.updateProfileIdentity).not.toHaveBeenCalled();
    });

    it('compensates Auth back to the prior identity when the profile update fails', async () => {
        const deps = dependencies();
        const failure = new Error('profile update failed');
        deps.updateProfileIdentity.mockRejectedValueOnce(failure);

        await expect(executeUsernameRename(input(), deps)).rejects.toBe(failure);

        expect(deps.updateAuthIdentity).toHaveBeenNthCalledWith(2, USER_ID, {
            email: 'old-internal@example.invalid',
            emailConfirm: true,
            userMetadata: { display_name: 'Budi', username: 'budi' }
        });
    });

    it('reports an explicit recovery failure when Auth compensation also fails', async () => {
        const deps = dependencies();
        deps.updateProfileIdentity.mockRejectedValueOnce(new Error('profile update failed'));
        deps.updateAuthIdentity
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('rollback failed'));

        await expect(executeUsernameRename(input(), deps))
            .rejects.toThrow('Username rename recovery failed');
    });
});
