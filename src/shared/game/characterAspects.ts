export const CHARACTER_ASPECTS = [
    { id: 'kejujuran', label: 'Kejujuran', character: 'yudhistira', levels: [1, 2] },
    { id: 'keberanian', label: 'Keberanian', character: 'bima', levels: [3, 4] },
    { id: 'kesopanan', label: 'Kesopanan', character: 'arjuna', levels: [5, 6] },
    { id: 'kebijaksanaan', label: 'Kebijaksanaan', character: 'nakula', levels: [7, 8] },
    { id: 'keadilan', label: 'Keadilan', character: 'sadewa', levels: [9, 10] }
] as const;

export type CharacterAspect = typeof CHARACTER_ASPECTS[number]['id'];
export interface JejakAnswer { cardId: string; basket: 'good' | 'bad' }

export function aspectForLevel(level: number): CharacterAspect | null {
    return CHARACTER_ASPECTS.find(aspect => (aspect.levels as readonly number[]).includes(level))?.id ?? null;
}

export function aspectForCharacter(character: string): CharacterAspect | null {
    return CHARACTER_ASPECTS.find(aspect => aspect.character === character)?.id ?? null;
}

export interface SchoolAspectAverage {
    schoolName: string;
    studentCount: number;
    jejakKnownCount: number;
    jejakVersion: 2;
    aspects: Array<{ id: CharacterAspect; missionAverage: number; jejakAverage: number | null }>;
}
