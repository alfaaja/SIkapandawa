import { describe, expect, it } from 'vitest';
import { normalizeListUsersParams } from './pagination';

describe('normalizeListUsersParams', () => {
    it('supplies safe defaults', () => {
        expect(normalizeListUsersParams({})).toEqual({
            schoolName: null,
            searchText: '',
            progressStatus: 'all',
            pageSize: 25,
            pageOffset: 0
        });
    });

    it('trims and limits search text to 80 characters', () => {
        const result = normalizeListUsersParams({
            searchText: `  ${'a'.repeat(90)}  `
        });

        expect(result.searchText).toBe('a'.repeat(80));
    });

    it.each(['all', 'not_started', 'in_progress', 'completed'] as const)(
        'preserves the allowed progress status %s',
        (progressStatus) => {
            expect(normalizeListUsersParams({ progressStatus }).progressStatus)
                .toBe(progressStatus);
        }
    );

    it('falls back to all for an unknown progress status', () => {
        expect(normalizeListUsersParams({ progressStatus: 'owner' }).progressStatus)
            .toBe('all');
    });

    it('falls back safely for non-finite and wrong-type pagination input', () => {
        expect(normalizeListUsersParams({
            pageSize: Number.POSITIVE_INFINITY,
            pageOffset: '25'
        })).toMatchObject({ pageSize: 25, pageOffset: 0 });
    });

    it.each([
        [{ pageSize: 0 }, 1],
        [{ pageSize: 101 }, 100],
        [{ pageSize: 12.9 }, 12],
        [{ pageOffset: -4 }, 0],
        [{ pageOffset: 4.9 }, 4]
    ] as const)('clamps integer pagination input %#', (input, expected) => {
        const result = normalizeListUsersParams(input);
        const actual = 'pageSize' in input ? result.pageSize : result.pageOffset;

        expect(actual).toBe(expected);
    });
});
