import { CHARACTER_ASPECTS, type CharacterAspect, type JejakAnswer } from '../../shared/game/characterAspects';

export const JEJAK_CURRICULUM_VERSION = 2;
export const JEJAK_CHARACTER_IDS = [
    'yudhistira',
    'bima',
    'arjuna',
    'nakula',
    'sadewa'
] as const;

export type JejakCharacterId = typeof JEJAK_CHARACTER_IDS[number];

export interface JejakCard {
    id: string;
    characterId: JejakCharacterId;
    aspect: CharacterAspect;
    value: string;
    text: string;
    isGood: boolean;
}

export interface JejakBasket {
    id: 'good' | 'bad';
    label: 'BAIK' | 'BURUK';
    accepts: boolean;
}

export interface JejakResultTier {
    min: number;
    max: number;
    title: 'LUAR BIASA' | 'BAGUS' | 'JANGAN MENYERAH';
    message: string;
}

/**
 * Active v2 curriculum. Revised wording receives a new ID; retired IDs remain
 * in the legacy database answer key for older clients and offline queues.
 */
export const JEJAK_CARDS: readonly JejakCard[] = [
    {
        id: 'yudhistira-01',
        characterId: 'yudhistira',
        aspect: 'kejujuran',
        value: 'kejujuran',
        text: 'Menyerahkan uang Rp10.000 yang ditemukan di lantai kelas kepada guru.',
        isGood: true
    },
    {
        id: 'yudhistira-02',
        characterId: 'yudhistira',
        aspect: 'kejujuran',
        value: 'kejujuran',
        text: 'Memberikan contekan saat ulangan agar disukai teman.',
        isGood: false
    },
    {
        id: 'yudhistira-04',
        characterId: 'yudhistira',
        aspect: 'kejujuran',
        value: 'kejujuran',
        text: 'Mengakui kepada guru bahwa kita yang tidak sengaja merusakkan penggaris kelas.',
        isGood: true
    },
    {
        id: 'bima-01',
        characterId: 'bima',
        aspect: 'keberanian',
        value: 'keberanian',
        text: 'Pura-pura tidak melihat saat adik kelas dipalak oleh kakak kelas.',
        isGood: false
    },
    {
        id: 'bima-02',
        characterId: 'bima',
        aspect: 'keberanian',
        value: 'ketegasan',
        text: 'Menolak dengan berani saat diajak teman membolos pelajaran.',
        isGood: true
    },
    {
        id: 'bima-03',
        characterId: 'bima',
        aspect: 'keberanian',
        value: 'ketegasan',
        text: 'Ikut mencoret tembok sekolah agar dianggap gaul.',
        isGood: false
    },
    {
        id: 'arjuna-01',
        characterId: 'arjuna',
        aspect: 'kesopanan',
        value: 'kesopanan',
        text: 'Menggebrak meja kantin dan berteriak karena tidak sabar mengantre.',
        isGood: false
    },
    {
        id: 'arjuna-02',
        characterId: 'arjuna',
        aspect: 'kesopanan',
        value: 'etika',
        text: 'Berpamitan dan mencium tangan orang tua sebelum berangkat sekolah.',
        isGood: true
    },
    {
        id: 'arjuna-03',
        characterId: 'arjuna',
        aspect: 'kesopanan',
        value: 'kesopanan',
        text: 'Mengucapkan permisi saat lewat di depan orang yang lebih tua.',
        isGood: true
    },
    {
        id: 'nakula-01',
        characterId: 'nakula',
        aspect: 'kebijaksanaan',
        value: 'kebiasaan-sehat',
        text: 'Menolak saat ditawari mencoba merokok dan mengingatkan bahayanya.',
        isGood: true
    },
    {
        id: 'nakula-02',
        characterId: 'nakula',
        aspect: 'kebijaksanaan',
        value: 'sesuai-umur',
        text: 'Menggunakan uang jajan untuk top-up judi slot online.',
        isGood: false
    },
    {
        id: 'nakula-03',
        characterId: 'nakula',
        aspect: 'kebijaksanaan',
        value: 'sesuai-umur',
        text: 'Ikut balap sepeda liar pada malam hari karena takut diejek teman.',
        isGood: false
    },
    {
        id: 'sadewa-04',
        characterId: 'sadewa',
        aspect: 'keadilan',
        value: 'keadilan',
        text: 'Menyuruh teman mengerjakan seluruh tugas piket, sementara kita tidak ikut membantu.',
        isGood: false
    },
    {
        id: 'sadewa-05',
        characterId: 'sadewa',
        aspect: 'keadilan',
        value: 'keadilan',
        text: 'Membagi tugas kelompok dengan adil agar setiap anggota mendapat bagian yang sesuai.',
        isGood: true
    },
    {
        id: 'sadewa-06',
        characterId: 'sadewa',
        aspect: 'keadilan',
        value: 'keadilan',
        text: 'Bergiliran memakai alat permainan supaya semua teman mendapat kesempatan.',
        isGood: true
    }
];

export const JEJAK_BASKETS: readonly JejakBasket[] = [
    { id: 'good', label: 'BAIK', accepts: true },
    { id: 'bad', label: 'BURUK', accepts: false }
];

export const JEJAK_RESULT_TIERS: readonly JejakResultTier[] = [
    {
        min: 8,
        max: 10,
        title: 'LUAR BIASA',
        message: 'Kamu sangat memahami nilai-nilai budi pekerti dan telah menjadi Ksatria Pandawa Cilik.'
    },
    {
        min: 5,
        max: 7,
        title: 'BAGUS',
        message: 'Kamu sudah memahami banyak perilaku baik. Teruslah berlatih.'
    },
    {
        min: 0,
        max: 4,
        title: 'JANGAN MENYERAH',
        message: 'Mainkan kembali Jejak Pandawa dan pelajari perbedaan perilaku baik dan buruk.'
    }
];

export function fisherYates<T>(source: readonly T[], rng: () => number = Math.random): T[] {
    const shuffled = [...source];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(rng() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled;
}

export function validateJejakRun(cards: readonly JejakCard[]): string[] {
    const errors: string[] = [];
    if (cards.length !== 10) errors.push(`Jumlah kartu harus 10, ditemukan ${cards.length}.`);
    if (new Set(cards.map((card) => card.id)).size !== cards.length) {
        errors.push('ID kartu dalam run harus unik.');
    }
    for (const characterId of JEJAK_CHARACTER_IDS) {
        const count = cards.filter((card) => card.characterId === characterId).length;
        if (count !== 2) errors.push(`${characterId} harus memiliki 2 kartu, ditemukan ${count}.`);
    }
    for (const aspect of CHARACTER_ASPECTS) {
        if (cards.filter(card => card.aspect === aspect.id).length !== 2) errors.push(aspect.label + ' harus memiliki 2 soal.');
    }
    return errors;
}

export function createJejakRun(rng: () => number = Math.random): JejakCard[] {
    const selected = CHARACTER_ASPECTS.flatMap((aspect) => {
        const group = JEJAK_CARDS.filter((card) => card.aspect === aspect.id);
        if (group.length < 2) {
            throw new Error(`Bank kartu ${aspect.label} kurang dari dua.`);
        }
        return fisherYates(group, rng).slice(0, 2);
    });
    const run = fisherYates(selected, rng);
    const errors = validateJejakRun(run);
    if (errors.length > 0) throw new Error(errors.join(' '));
    return run;
}

export function scoreJejakAnswers(answers: readonly JejakAnswer[]): Record<CharacterAspect, number> {
    if (answers.length !== 10 || new Set(answers.map(answer => answer.cardId)).size !== 10) throw new Error('Jawaban Jejak tidak lengkap.');
    const scores = Object.fromEntries(CHARACTER_ASPECTS.map(aspect => [aspect.id, 0])) as Record<CharacterAspect, number>;
    const counts = { ...scores };
    for (const answer of answers) {
        const card = JEJAK_CARDS.find(card => card.id === answer.cardId);
        if (!card || !['good','bad'].includes(answer.basket)) throw new Error('Jawaban Jejak tidak valid.');
        counts[card.aspect]++;
        if ((answer.basket === 'good') === card.isGood) scores[card.aspect]++;
    }
    if (Object.values(counts).some(count => count !== 2)) throw new Error('Setiap aspek harus memiliki dua jawaban.');
    return scores;
}

export function getJejakResultTier(score: number): JejakResultTier {
    const clamped = Math.max(0, Math.min(10, Math.floor(score)));
    return JEJAK_RESULT_TIERS.find((tier) => clamped >= tier.min && clamped <= tier.max)
        ?? JEJAK_RESULT_TIERS[2];
}

if (import.meta.env.DEV) {
    const bankIds = new Set(JEJAK_CARDS.map((card) => card.id));
    if (JEJAK_CARDS.length !== 15 || bankIds.size !== 15) {
        throw new Error('Bank Jejak Pandawa harus berisi tepat 15 ID unik.');
    }
    for (const characterId of JEJAK_CHARACTER_IDS) {
        if (JEJAK_CARDS.filter((card) => card.characterId === characterId).length !== 3) {
            throw new Error(`Bank ${characterId} harus berisi tepat tiga kartu.`);
        }
    }
    const smokingCard = JEJAK_CARDS.find((card) => card.id === 'nakula-01');
    if (smokingCard?.isGood !== true) {
        throw new Error('Normalisasi kartu menolak rokok harus bernilai baik.');
    }
}
