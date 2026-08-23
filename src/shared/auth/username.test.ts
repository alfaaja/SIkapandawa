import { describe, expect, it } from 'vitest';
import {
    buildInternalAuthEmail,
    normalizeUsername,
    validateUsername
} from './username';

describe('username helpers', () => {
    it('normalizes whitespace, Unicode compatibility characters, and casing', () => {
        expect(normalizeUsername('  ＡNDI_01  ')).toBe('andi_01');
    });

    it.each([
        'abc',
        'a'.repeat(20),
        'andi.01',
        'andi_01',
        'andi-01'
    ])('accepts a valid username: %s', (username) => {
        expect(validateUsername(username)).toBe(username);
    });

    it.each([
        '',
        'ab',
        'a'.repeat(21),
        'andi 01',
        '<admin>',
        'andí'
    ])('rejects an invalid username: %s', (username) => {
        expect(validateUsername(username)).toBeNull();
    });

    it('preserves the legacy deterministic internal-email algorithm', async () => {
        await expect(buildInternalAuthEmail(' BUDI ')).resolves.toBe(
            '24263bfaefb124c488c2f5e63d1d30b418f51d0d6f5b380aa1956ec40ea57278@users.sikapandawa.invalid'
        );
    });

    it('derives a new login identity when a normalized username changes', async () => {
        const oldEmail = await buildInternalAuthEmail('budi');
        const renamedEmail = await buildInternalAuthEmail('budi.baru');

        expect(renamedEmail).not.toBe(oldEmail);
        await expect(buildInternalAuthEmail('  BUDI.BARU  ')).resolves.toBe(renamedEmail);
    });

    it('rejects invalid usernames before hashing', async () => {
        await expect(buildInternalAuthEmail('ab')).rejects.toThrow('Invalid username');
    });
});
