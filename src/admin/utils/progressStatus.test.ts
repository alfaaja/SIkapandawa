import { describe, expect, it } from 'vitest';
import { deriveProgressStatus } from './progressStatus';

describe('deriveProgressStatus', () => {
    it.each([
        [0, 'not_started'],
        [1, 'in_progress'],
        [9, 'in_progress'],
        [10, 'completed']
    ] as const)('maps %i completed levels to %s', (count, expected) => {
        expect(deriveProgressStatus(count)).toBe(expected);
    });

    it.each([-1, 11, 1.5, Number.NaN])(
        'rejects invalid completed-level count %s',
        (count) => {
            expect(() => deriveProgressStatus(count)).toThrow(RangeError);
        }
    );
});
