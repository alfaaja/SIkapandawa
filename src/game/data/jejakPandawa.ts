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
 * Salinan runtime dari docs/data/JEJAK_PANDAWA_CARDS.json.
 * JSON tersebut tetap sumber kebenaran konten P09; constant ini dipakai karena
 * pipeline TypeScript aplikasi tidak mengaktifkan resolveJsonModule.
 */
export const JEJAK_CARDS: readonly JejakCard[] = [
    {
        id: 'yudhistira-01',
        characterId: 'yudhistira',
        value: 'kejujuran',
        text: 'Menyerahkan uang Rp10.000 yang ditemukan di lantai kelas kepada guru.',
        isGood: true
    },
    {
        id: 'yudhistira-02',
        characterId: 'yudhistira',
        value: 'kejujuran',
        text: 'Memberikan sontekan saat ulangan agar disukai teman.',
        isGood: false
    },
    {
        id: 'yudhistira-03',
        characterId: 'yudhistira',
        value: 'kesabaran',
        text: 'Memaafkan dan menolong teman yang sengaja menyipratkan lumpur ke seragam kita.',
        isGood: true
    },
    {
        id: 'bima-01',
        characterId: 'bima',
        value: 'keberanian',
        text: 'Pura-pura tidak melihat saat adik kelas dipalak oleh kakak kelas.',
        isGood: false
    },
    {
        id: 'bima-02',
        characterId: 'bima',
        value: 'ketegasan',
        text: 'Menolak dengan berani saat diajak teman membolos pelajaran.',
        isGood: true
    },
    {
        id: 'bima-03',
        characterId: 'bima',
        value: 'ketegasan',
        text: 'Ikut mencoret tembok sekolah agar dianggap gaul.',
        isGood: false
    },
    {
        id: 'arjuna-01',
        characterId: 'arjuna',
        value: 'kesopanan',
        text: 'Menggebrak meja kantin dan berteriak karena tidak sabar mengantre.',
        isGood: false
    },
    {
        id: 'arjuna-02',
        characterId: 'arjuna',
        value: 'etika',
        text: 'Berpamitan dan mencium tangan orang tua sebelum berangkat sekolah.',
        isGood: true
    },
    {
        id: 'arjuna-03',
        characterId: 'arjuna',
        value: 'kesopanan',
        text: 'Mengucapkan permisi saat lewat di depan orang yang lebih tua.',
        isGood: true
    },
    {
        id: 'nakula-01',
        characterId: 'nakula',
        value: 'kebiasaan-sehat',
        text: 'Menolak saat ditawari mencoba merokok dan mengingatkan bahayanya.',
        isGood: true
    },
    {
        id: 'nakula-02',
        characterId: 'nakula',
        value: 'sesuai-umur',
        text: 'Menggunakan uang jajan untuk top-up judi slot online.',
        isGood: false
    },
    {
        id: 'nakula-03',
        characterId: 'nakula',
        value: 'sesuai-umur',
        text: 'Ikut balap sepeda liar pada malam hari karena takut diejek teman.',
        isGood: false
    },
    {
        id: 'sadewa-01',
        characterId: 'sadewa',
        value: 'tanggung-jawab',
        text: 'Menyembunyikan debu dan sampah di bawah meja agar piket cepat selesai.',
        isGood: false
    },
    {
        id: 'sadewa-02',
        characterId: 'sadewa',
        value: 'kebersihan',
        text: 'Memindahkan botol plastik yang menyumbat selokan ke tempat sampah.',
        isGood: true
    },
    {
        id: 'sadewa-03',
        characterId: 'sadewa',
        value: 'kesehatan',
        text: 'Mencuci tangan dengan sabun dan air mengalir sebelum makan.',
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
    return errors;
}

export function createJejakRun(rng: () => number = Math.random): JejakCard[] {
    const selected = JEJAK_CHARACTER_IDS.flatMap((characterId) => {
        const group = JEJAK_CARDS.filter((card) => card.characterId === characterId);
        if (group.length < 2) {
            throw new Error(`Bank kartu ${characterId} kurang dari dua.`);
        }
        return fisherYates(group, rng).slice(0, 2);
    });
    const run = fisherYates(selected, rng);
    const errors = validateJejakRun(run);
    if (errors.length > 0) throw new Error(errors.join(' '));
    return run;
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
