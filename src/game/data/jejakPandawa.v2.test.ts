import { expect, it } from 'vitest';
import { JEJAK_CARDS, createJejakRun, scoreJejakAnswers } from './jejakPandawa';
import { CHARACTER_ASPECTS } from '../../shared/game/characterAspects';

it('classifies all 15 questions explicitly and replaces the four unsuitable questions with new IDs', () => {
    expect(JEJAK_CARDS).toHaveLength(15);
    for (const aspect of CHARACTER_ASPECTS) expect(JEJAK_CARDS.filter(card => card.aspect === aspect.id)).toHaveLength(3);
    for (const retired of ['yudhistira-03','sadewa-01','sadewa-02','sadewa-03']) expect(JEJAK_CARDS.some(card => card.id === retired)).toBe(false);
    expect(JEJAK_CARDS.find(card => card.id === 'yudhistira-04')?.text).toContain('Mengakui');
    expect(JEJAK_CARDS.filter(card => card.aspect === 'keadilan').map(card => card.text).join(' ')).toMatch(/tugas piket.*adil.*Bergiliran/s);
    for (let run = 0; run < 25; run++) {
        const cards = createJejakRun();
        expect(new Set(cards.map(card => card.id)).size).toBe(10);
        for (const aspect of CHARACTER_ASPECTS) expect(cards.filter(card => card.aspect === aspect.id)).toHaveLength(2);
    }
});

it('scores each classified answer independently and rejects incomplete or repeated question sets', () => {
    const ids = ['yudhistira-01','yudhistira-02','bima-01','bima-02','arjuna-01','arjuna-02','nakula-01','nakula-02','sadewa-04','sadewa-05'];
    const baskets = ['good','bad','good','bad','bad','bad','good','bad','bad','bad'] as const;
    const answers = ids.map((cardId,index) => ({ cardId, basket: baskets[index] }));
    expect(scoreJejakAnswers(answers)).toEqual({kejujuran:2,keberanian:0,kesopanan:1,kebijaksanaan:2,keadilan:1});
    expect(scoreJejakAnswers([...answers].reverse())).toEqual(scoreJejakAnswers(answers));
    expect(() => scoreJejakAnswers(answers.slice(1))).toThrow();
    expect(() => scoreJejakAnswers(answers.map(() => answers[0]))).toThrow();
    expect(() => scoreJejakAnswers(answers.map(answer => ({ ...answer,cardId:'made-up' })))).toThrow();
});
