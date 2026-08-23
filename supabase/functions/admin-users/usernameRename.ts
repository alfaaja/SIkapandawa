export interface AuthIdentityUpdate {
    email: string;
    emailConfirm: boolean;
    userMetadata: Record<string, unknown>;
}

export interface UsernameRenameInput {
    userId: string;
    currentEmail: string;
    currentMetadata: Record<string, unknown>;
    currentUsername: string;
    newEmail: string;
    newMetadata: Record<string, unknown>;
    newUsername: string;
    newDisplayName: string;
}

export interface UsernameRenameDependencies {
    revokeSessions(userId: string): Promise<void>;
    updateAuthIdentity(userId: string, identity: AuthIdentityUpdate): Promise<void>;
    updateProfileIdentity(input: {
        userId: string;
        expectedUsername: string;
        newUsername: string;
        newDisplayName: string;
    }): Promise<void>;
}

/**
 * Coordinates a username rename across Auth and the profile table. The Auth
 * identity must move first so a unique internal email collision cannot leave
 * the public profile pointing at a login that was never created. If the
 * database step then fails, restore the prior Auth identity best-effort and
 * preserve the original failure for the caller.
 */
export async function executeUsernameRename(
    input: UsernameRenameInput,
    dependencies: UsernameRenameDependencies
): Promise<{ userId: string }> {
    await dependencies.revokeSessions(input.userId);
    await dependencies.updateAuthIdentity(input.userId, {
        email: input.newEmail,
        emailConfirm: true,
        userMetadata: { ...input.newMetadata }
    });

    try {
        await dependencies.updateProfileIdentity({
            userId: input.userId,
            expectedUsername: input.currentUsername,
            newUsername: input.newUsername,
            newDisplayName: input.newDisplayName
        });
    } catch (profileError) {
        try {
            await dependencies.updateAuthIdentity(input.userId, {
                email: input.currentEmail,
                emailConfirm: true,
                userMetadata: { ...input.currentMetadata }
            });
        } catch {
            // Callers map this fixed internal condition to a generic public
            // response; no Auth identity or provider detail is disclosed.
            throw new Error('Username rename recovery failed');
        }
        throw profileError;
    }

    return { userId: input.userId };
}
