import { describe, expect, it } from 'vitest';
import { CHARACTER_ASPECTS, aspectForCharacter, aspectForLevel } from './characterAspects';
import { createJejakRun, JEJAK_CARDS } from '../../game/data/jejakPandawa';

describe('five character aspects', () => {
    it('maps each consecutive pair of mission levels in the requested order', () => {
        expect(Array.from({ length: 10 }, (_, i) => aspectForLevel(i + 1))).toEqual(
            ['kejujuran', 'keberanian', 'kesopanan', 'kebijaksanaan', 'keadilan'].flatMap(x => [x, x])
        );
        expect(aspectForLevel(0)).toBeNull();
        expect(aspectForLevel(11)).toBeNull();
        expect(aspectForLevel(1.5)).toBeNull();
    });
    it('classifies every Jejak card and every randomized run contains two per aspect', () => {
        expect(CHARACTER_ASPECTS).toHaveLength(5);
        expect(JEJAK_CARDS.every(card => aspectForCharacter(card.characterId))).toBe(true);
        for (let i = 0; i < 30; i++) {
            const run = createJejakRun();
            for (const aspect of CHARACTER_ASPECTS) {
                expect(run.filter(card => aspectForCharacter(card.characterId) === aspect.id)).toHaveLength(2);
            }
        }
        expect(aspectForCharacter('unknown')).toBeNull();
    });
});
