import { describe, expect, it } from 'vitest';
import { normalizeSchoolName } from './school';

describe('school name validation', () => {
    it('normalizes whitespace and casing so one school is not split into separate chart groups', () => {
        expect(normalizeSchoolName('  sdn  Kalibanteng Kulon 01 ')).toBe('SDN Kalibanteng Kulon 01');
    });
    it.each(['', '  ', 'A', 'x'.repeat(101), 'SDN\u0000A', null])('rejects invalid school names %#', value => {
        expect(normalizeSchoolName(value)).toBeNull();
    });
});
