import { describe, expect, it } from 'vitest';
import { formatDateTime, formatStatus } from './formatters';

describe('formatDateTime', () => {
    it('formats an ISO timestamp in Indonesian using the Jakarta timezone', () => {
        expect(formatDateTime('2026-08-10T00:00:00.000Z'))
            .toBe('10 Agu 2026, 07.00');
    });

    it.each([null, undefined, '', 'not-a-date'])(
        'returns a readable fallback for %s',
        (value) => {
            expect(formatDateTime(value)).toBe('—');
        }
    );
});

describe('formatStatus', () => {
    it.each([
        ['not_started', 'Belum mulai'],
        ['in_progress', 'Sedang bermain'],
        ['completed', 'Selesai'],
        ['unexpected', 'Tidak diketahui']
    ])('formats %s as %s', (status, expected) => {
        expect(formatStatus(status)).toBe(expected);
    });
});
