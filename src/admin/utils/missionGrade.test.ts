import { describe, expect, it } from 'vitest';
import { deriveMissionGrade } from './missionGrade';

describe('deriveMissionGrade', () => {
    it.each([
        [0, 'Awal Perjalanan'],
        [6, 'Awal Perjalanan'],
        [7, 'Terus Belajar'],
        [12, 'Terus Belajar'],
        [13, 'Teman yang Baik'],
        [18, 'Teman yang Baik'],
        [19, 'Calon Ksatria Hebat'],
        [24, 'Calon Ksatria Hebat'],
        [25, 'Ksatria Sejati'],
        [30, 'Ksatria Sejati']
    ] as const)('maps %i total stars to the official rank %s', (stars, rank) => {
        expect(deriveMissionGrade(stars)).toBe(rank);
    });

    it.each([-1, 31, 1.5, Number.NaN])('rejects invalid total stars %s', (stars) => {
        expect(() => deriveMissionGrade(stars)).toThrow(RangeError);
    });
});
