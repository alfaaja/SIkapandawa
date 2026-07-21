import {
    LevelDefinition, SegmentDefinition, SpeakerStyle, ObjectPlacement
} from '../types/gameplay';

/**
 * Data Level 1–2. Seluruh dialog/pilihan/feedback verbatim dari
 * docs/data/NARRATIVE_LEVEL_01_02.json (jawaban benar: L1 C,A,B — L2 C,C,A).
 * Posisi memakai koordinat logis dari docs/LEVEL_01_02_SCENE_MAP.md.
 */

export const WORLD_WIDTH = 1700;
export const WORLD_HEIGHT = 720;
export const GROUND_Y = 560;
const EXIT_X = 1560;

export const SPEAKERS_LV1: Record<string, SpeakerStyle> = {
    'pak-guru': { displayName: 'Pak Guru', textboxTexture: 'lv1-textboxt-pak-guru' },
    'budi': { displayName: 'Budi', textboxTexture: 'lv1-textboxt-budi' },
    'edo': { displayName: 'Edo', textboxTexture: 'lv1-textboxt-edo' }
};

export const SPEAKERS_LV2: Record<string, SpeakerStyle> = {
    'pak-guru-olahraga': { displayName: 'Pak Guru Olahraga', textboxTexture: 'lv2-textboxt-pak-guru-olagraga' },
    'budi': { displayName: 'Budi', textboxTexture: 'lv2-textbox-budi-olahraga' },
    'siti': { displayName: 'Siti', textboxTexture: 'lv2-textbox-siti-olahraga' },
    'ani': { displayName: 'Ani', textboxTexture: 'lv2-textbox-ani-olahraga' },
    'yudhistira': { displayName: 'Yudistira', textboxTexture: 'lv2-textbox-yudistira-olahraga' }
};

// Tempat duduk siswa (4 anak) + kursi pemain. Tiap tempat = satu kursi + satu
// meja individual di depannya (mengikuti komposisi lv1_1_prev.png). `meja-single`
// adalah satu meja hasil potongan dari sprite-sheet meja (6 frame), bukan sheet
// penuh — memperbaiki tumpukan meja yang berlebihan.
const LV1_KID_SEATS = [290, 525, 760, 995];
const LV1_PLAYER_SEAT = 1227;
const DESK_OFFSET = 80;
const LV1_TEACHER_DESK = 1410;

/** Furniture kelas Level 1 (kursi siswa + meja individual + area guru). */
function lv1Furniture(): ObjectPlacement[] {
    const objects: ObjectPlacement[] = [];
    const seats = [...LV1_KID_SEATS, LV1_PLAYER_SEAT];
    seats.forEach((x, i) => {
        objects.push({ id: `kursi-${i}`, texture: 'kursi-siswa', x, y: GROUND_Y, depth: 4 });
        objects.push({ id: `meja-${i}`, texture: 'meja-single', x: x + DESK_OFFSET, y: GROUND_Y, depth: 8 });
    });
    objects.push({ id: 'meja-guru', texture: 'meja-single', x: LV1_TEACHER_DESK, y: GROUND_Y, depth: 8 });
    objects.push({ id: 'kursi-guru', texture: 'kursi-guru', x: LV1_TEACHER_DESK + 95, y: GROUND_Y, depth: 4 });
    return objects;
}

const LV1_KIDS = [
    { id: 'budi', texture: 'budi-duduk', x: LV1_KID_SEATS[0] },
    { id: 'edo', texture: 'edo-duduk', x: LV1_KID_SEATS[1] },
    { id: 'siti', texture: 'siti-duduk', x: LV1_KID_SEATS[2] },
    { id: 'ani', texture: 'ani-duduk', x: LV1_KID_SEATS[3] }
];

const LV1_SEGMENTS: SegmentDefinition[] = [
    {
        id: 'lv1-event-1',
        order: 1,
        title: 'Mengakui Vas yang Jatuh',
        spawnX: 95,
        initialCameraX: 0,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: [
            ...LV1_KIDS.map((k) => ({ ...k, depth: 6 })),
            { id: 'pak-guru', texture: 'pak-guru-duduk', x: LV1_TEACHER_DESK + 95, depth: 6, hidden: true }
        ],
        objects: [
            ...lv1Furniture(),
            { id: 'vas', texture: 'vas', x: LV1_TEACHER_DESK, y: 452, depth: 9 },
            { id: 'vas-jatuh', texture: 'vas-jatuh', x: LV1_TEACHER_DESK - 45, y: GROUND_Y, depth: 9, hidden: true }
        ],
        scriptedSequence: [
            { kind: 'walk', targetX: 1360 },
            { kind: 'swapObject', objectId: 'vas', texture: null },
            { kind: 'swapObject', objectId: 'vas-jatuh', texture: 'vas-jatuh' },
            { kind: 'wait', ms: 350 },
            { kind: 'walk', targetX: 150, speed: 340 },
            { kind: 'wait', ms: 250 },
            { kind: 'showActor', actorId: 'pak-guru' },
            {
                kind: 'dialog',
                lines: [{
                    speaker: 'pak-guru',
                    text: 'Anak-anak, kelas akan segera dimulai. Silakan duduk di tempat duduk masing-masing, ya!'
                }]
            }
        ],
        interactions: [
            {
                id: 'lv1-s1-kursi',
                order: 1,
                triggerX: 1227,
                markerY: 370,
                interactionRadius: 70,
                sitAtX: 1227,
                dialog: [
                    { speaker: 'pak-guru', text: 'Siapa yang menjatuhkan vas bunga Bapak?' }
                ],
                question: {
                    choices: [
                        { id: 'A', text: 'Pura-pura tidak tahu apa-apa.' },
                        { id: 'B', text: 'Menunjuk Budi dan berkata bahwa Budi yang menyenggol vas.' },
                        { id: 'C', text: 'Mengakui kesalahan, meminta maaf kepada Pak Guru, dan membantu membersihkan.' }
                    ],
                    correctChoiceId: 'C',
                    feedback: {
                        A: { speaker: 'pak-guru', correct: false, text: 'Anak-anak, vas Bapak pecah. Tidak ada yang mau mengaku? Menyembunyikan kesalahan akan membuat hati kalian tidak tenang seharian.' },
                        B: { speaker: 'pak-guru', correct: false, text: 'Yudhistira, menyalahkan teman padahal kamu yang melakukannya adalah kebohongan yang jauh lebih besar. Jangan memfitnah temanmu.' },
                        C: { speaker: 'pak-guru', correct: true, text: 'Bapak menghargai keberanianmu, Yudhistira. Berani mengakui kesalahan adalah puncak kejujuran. Tidak apa-apa, mari kita bersihkan bersama.' }
                    }
                },
                onResolveHideObjects: ['vas-jatuh'],
                onResolveShowObjects: ['vas']
            }
        ],
        exitX: EXIT_X
    },
    {
        id: 'lv1-event-2',
        order: 2,
        title: 'Mengembalikan Uang yang Ditemukan',
        spawnX: 95,
        initialCameraX: 0,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: [
            ...LV1_KIDS.map((k) => ({ ...k, depth: 6 })),
            { id: 'pak-guru', texture: 'pak-guru-duduk', x: LV1_TEACHER_DESK + 95, depth: 6 }
        ],
        objects: [
            ...lv1Furniture(),
            { id: 'vas', texture: 'vas', x: LV1_TEACHER_DESK, y: 452, depth: 9 },
            { id: 'koin', texture: 'koin', x: 480, y: GROUND_Y, depth: 9 }
        ],
        interactions: [
            {
                id: 'lv1-s2-koin',
                order: 1,
                triggerX: 480,
                markerY: 500,
                interactionRadius: 60,
                collectObjectId: 'koin',
                dialog: []
            },
            {
                id: 'lv1-s2-kursi',
                order: 2,
                triggerX: 1227,
                markerY: 370,
                interactionRadius: 70,
                sitAtX: 1227,
                dialog: [
                    { speaker: 'budi', text: 'Pak Guru, saya kehilangan uang milik saya, Pak!' },
                    { speaker: 'pak-guru', text: 'Anak-anak, apakah ada yang melihat uang Budi yang hilang?' }
                ],
                question: {
                    choices: [
                        { id: 'A', text: 'Menyerahkan uang itu kepada Pak Guru di depan kelas.' },
                        { id: 'B', text: 'Menyembunyikan uang itu di saku untuk dipakai jajan.' },
                        { id: 'C', text: 'Membiarkan uang itu di lantai dan berpura-pura tidak melihatnya.' }
                    ],
                    correctChoiceId: 'A',
                    feedback: {
                        A: { speaker: 'pak-guru', correct: true, text: 'Terima kasih, Yudhistira! Anak-anak, siapa yang uangnya hilang? Mari kita contoh Yudhistira yang jujur mengamankan barang yang bukan miliknya.' },
                        B: { speaker: 'pak-guru', correct: false, text: 'Yudhistira, Bapak melihat kamu memasukkan uang temanmu ke saku. Mengambil hak orang lain itu tidak jujur, Nak. Kembalikan, ya.' },
                        C: { speaker: 'pak-guru', correct: false, text: 'Yudhistira, kalau kita melihat barang teman yang hilang, sebaiknya kita bantu amankan, bukan didiamkan saja. Mari peduli kepada teman.' }
                    }
                }
            }
        ],
        exitX: EXIT_X
    },
    {
        id: 'lv1-event-3',
        order: 3,
        title: 'Menolak Menyontek',
        spawnX: 1227,
        spawnSeated: true,
        initialCameraX: 420,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: [
            ...LV1_KIDS.map((k) => ({ ...k, depth: 6 })),
            { id: 'pak-guru', texture: 'pak-guru-duduk', x: LV1_TEACHER_DESK + 95, depth: 6 }
        ],
        objects: [
            ...lv1Furniture(),
            { id: 'vas', texture: 'vas', x: LV1_TEACHER_DESK, y: 452, depth: 9 },
            { id: 'gumpalan', texture: 'gumpalan-kertas', x: 1140, y: GROUND_Y, depth: 9, hidden: true }
        ],
        scriptedSequence: [
            { kind: 'wait', ms: 400 },
            { kind: 'dropObject', objectId: 'gumpalan', fromY: 200, toY: GROUND_Y, ms: 700 }
        ],
        interactions: [
            {
                id: 'lv1-s3-gumpalan',
                order: 1,
                triggerX: 1140,
                markerY: 495,
                interactionRadius: 100,
                dialog: [
                    { speaker: 'edo', text: 'Yudhistira, aku boleh menyontek jawabanmu? Nanti aku kasih kamu permen.' }
                ],
                question: {
                    choices: [
                        { id: 'A', text: 'Menuliskan jawaban yang benar dan melemparkannya kembali karena ingin permen.' },
                        { id: 'B', text: 'Menggeleng sambil tersenyum untuk menolak, lalu kembali fokus mengerjakan soal sendiri.' },
                        { id: 'C', text: 'Menuliskan jawaban yang salah dengan sengaja agar Edo kesal, lalu melemparkannya kembali.' }
                    ],
                    correctChoiceId: 'B',
                    feedback: {
                        A: { speaker: 'pak-guru', correct: false, text: 'Edo dan Yudhistira, Bapak melihat kalian bertukar jawaban. Bekerja sama dalam ulangan seperti itu sama dengan membohongi diri sendiri.' },
                        B: { speaker: 'pak-guru', correct: true, text: 'Bapak memperhatikan ada yang mencoba menyontek, tetapi ada yang menolak dengan tegas. Bapak sangat bangga kepada anak yang mempertahankan kejujurannya.' },
                        C: { speaker: 'pak-guru', correct: false, text: 'Yudhistira, selain tidak boleh menyontek, berbuat jahil dengan memberikan jawaban salah juga bukan perbuatan yang baik.' }
                    }
                },
                onResolveHideObjects: ['gumpalan']
            }
        ],
        exitX: EXIT_X
    }
];

export const LEVEL_1: LevelDefinition = {
    id: 1,
    title: 'Di Dalam Kelas',
    subtitle: 'Ujian Kejujuran',
    assetPrefix: 'lv1',
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    groundY: GROUND_Y,
    player: {
        idleTexture: 'yudistira-tegap',
        seatedTexture: 'yudistira-duduk',
        walkRightTextures: [
            'yudistira-langkah-kanan-1', 'yudistira-langkah-kanan-2',
            'yudistira-langkah-kanan-3', 'yudistira-langkah-kanan-4'
        ],
        walkLeftTextures: [
            'yudistira-langkah-kiri-1', 'yudistira-langkah-kiri-2',
            'yudistira-langkah-kiri-3', 'yudistira-langkah-kiri-4'
        ],
        walkSpeed: 260,
        animFps: 9
    },
    segments: LV1_SEGMENTS,
    conclusionTitle: 'KESIMPULAN NILAI KEJUJURAN',
    conclusion:
        'Menjadi anak yang jujur berarti kita berani mengembalikan barang yang bukan ' +
        'milik kita, percaya pada kemampuan diri sendiri tanpa menyontek, dan berani ' +
        'mengakui kesalahan. Dengan selalu bersikap jujur, hati kita akan tenang dan ' +
        'kita akan dipercaya oleh banyak orang!',
    introCharacterId: 'yudhistira'
};

/** Barisan olahraga Level 2: Ani, Edo, [slot pemain], Budi, Siti. */
const LV2_LINE = [
    { id: 'ani', texture: 'ani-olahraga-kiri', x: 610 },
    { id: 'edo', texture: 'edo-olahraga-kiri', x: 680 },
    { id: 'budi', texture: 'budi-olahraga-kiri', x: 890 },
    { id: 'siti', texture: 'siti-olahraga-kiri', x: 965 }
];

const LV2_SEGMENTS: SegmentDefinition[] = [
    {
        id: 'lv2-event-1',
        order: 1,
        title: 'Tidak Membeda-bedakan Teman',
        spawnX: 95,
        initialCameraX: 0,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: [
            { id: 'pak-guru-olahraga', texture: 'pak-guru-olahraga', x: 437, depth: 6 },
            ...LV2_LINE.map((k) => ({ ...k, depth: 6 }))
        ],
        objects: [],
        interactions: [
            {
                id: 'lv2-s1-barisan',
                order: 1,
                triggerX: 790,
                markerY: 240,
                interactionRadius: 70,
                dialog: [
                    { speaker: 'pak-guru-olahraga', text: 'Ayo, anak-anak, kita mulai olahraga bersama!' }
                ]
            },
            {
                id: 'lv2-s1-pertengkaran',
                order: 2,
                triggerX: 930,
                markerY: 240,
                interactionRadius: 95,
                onStartSwaps: [{ actorId: 'budi', texture: 'budi-olahraga-marah' }],
                dialog: [
                    { speaker: 'budi', text: 'Siti, aku tidak mau kamu berdiri di belakangku. Pindah saja ke sana!' },
                    { speaker: 'siti', text: 'Aku hanya ingin ikut olahraga, Bud!' }
                ],
                question: {
                    choices: [
                        { id: 'A', text: 'Menuruti Budi dan menyuruh Siti pindah.' },
                        { id: 'B', text: 'Membiarkan mereka berdua bertengkar.' },
                        { id: 'C', text: 'Melerai mereka, menyemangati keduanya, dan melanjutkan olahraga bersama.' }
                    ],
                    correctChoiceId: 'C',
                    feedback: {
                        A: { speaker: 'pak-guru-olahraga', correct: false, text: 'Yudhistira, kita tidak boleh membeda-bedakan teman. Semua anak berhak berolahraga bersama.' },
                        B: { speaker: 'pak-guru-olahraga', correct: false, text: 'Membiarkan teman bertengkar juga tidak dibenarkan, ya, Yudhistira!' },
                        C: { speaker: 'pak-guru-olahraga', correct: true, text: 'Bagus sekali, Yudhistira! Melerai teman yang bertengkar adalah sikap seorang kesatria!' }
                    }
                },
                onResolveSwaps: [{ actorId: 'budi', texture: 'budi-olahraga-kiri' }]
            }
        ],
        exitX: EXIT_X
    },
    {
        id: 'lv2-event-2',
        order: 2,
        title: 'Membagi Air secara Adil',
        spawnX: 95,
        initialCameraX: 0,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: [
            { id: 'pak-guru-olahraga', texture: 'pak-guru-olahraga', x: 437, depth: 6 },
            ...LV2_LINE.map((k) => ({ ...k, depth: 6 }))
        ],
        objects: [
            { id: 'meja-botol', texture: 'meja-botol', x: 1430, y: GROUND_Y, depth: 8 }
        ],
        interactions: [
            {
                id: 'lv2-s2-barisan',
                order: 1,
                triggerX: 790,
                markerY: 240,
                interactionRadius: 70,
                dialog: [
                    { speaker: 'yudhistira', text: 'Wah, ada air mineral. Aku ambil dulu, kalau begitu.' }
                ]
            },
            {
                id: 'lv2-s2-botol',
                order: 2,
                triggerX: 1430,
                markerY: 430,
                interactionRadius: 85,
                dialog: [],
                question: {
                    choices: [
                        { id: 'A', text: 'Mengambil dua botol untuk diri sendiri karena sangat haus, lalu membagikan sisanya.' },
                        { id: 'B', text: 'Membagikan air hanya kepada teman-teman dekatnya.' },
                        { id: 'C', text: 'Membagikan satu botol kepada setiap teman dan mengambil satu botol untuk dirinya sendiri.' }
                    ],
                    correctChoiceId: 'C',
                    feedback: {
                        A: { speaker: 'ani', correct: false, text: 'Kok kamu minum dua botol, Yudhistira? Aku jadi tidak mendapat minum. Itu tidak adil.' },
                        B: { speaker: 'ani', correct: false, text: 'Yudhistira, kenapa hanya sahabatmu yang diberi minum? Kita satu tim, seharusnya dibagi dengan adil.' },
                        C: { speaker: 'ani', correct: true, text: 'Terima kasih, Yudhistira! Kamu membaginya dengan rata dan adil. Semua jadi tidak kehausan lagi!' }
                    }
                }
            }
        ],
        exitX: EXIT_X
    },
    {
        id: 'lv2-event-3',
        order: 3,
        title: 'Menyelesaikan Perebutan Bola dengan Aturan',
        spawnX: 95,
        initialCameraX: 0,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: [
            { id: 'pak-guru-olahraga', texture: 'pak-guru-olahraga', x: 437, depth: 6 },
            { id: 'edo', texture: 'edo-olahraga-kiri', x: 700, depth: 6, flipX: true },
            { id: 'ani', texture: 'ani-olahraga-kanan', x: 758, depth: 6 },
            { id: 'berebut', texture: 'berebut-bola', x: 826, depth: 7 }
        ],
        objects: [],
        interactions: [
            {
                id: 'lv2-s3-bola',
                order: 1,
                triggerX: 826,
                markerY: 230,
                interactionRadius: 95,
                dialog: [
                    { speaker: 'siti', text: 'Bergantian dong, Budi. Aku juga mau memakai bolanya!' },
                    { speaker: 'budi', text: 'Sabar, aku juga masih mau bermain.' }
                ],
                question: {
                    choices: [
                        { id: 'A', text: 'Menengahi mereka, memeriksa urutan giliran, dan meminta mereka bermain bergantian tanpa pilih kasih.' },
                        { id: 'B', text: 'Membela Siti dan langsung menyuruh Budi mengalah hanya karena Siti adalah teman dekatnya.' },
                        { id: 'C', text: 'Marah-marah, menyita bola, dan membubarkan permainan karena mereka berisik.' }
                    ],
                    correctChoiceId: 'A',
                    feedback: {
                        A: { speaker: 'pak-guru-olahraga', correct: true, text: 'Ini baru Pandawa Cilik! Kamu menyelesaikan pertengkaran dengan adil berdasarkan aturan, bukan berdasarkan pertemanan.' },
                        B: { speaker: 'pak-guru-olahraga', correct: false, text: 'Yudhistira, keadilan berarti tidak memihak. Jangan membela seseorang hanya karena ia sahabatmu.' },
                        C: { speaker: 'pak-guru-olahraga', correct: false, text: 'Pemimpin yang baik menyelesaikan masalah dengan adil, bukan marah dan menghindari masalah.' }
                    }
                }
            }
        ],
        exitX: EXIT_X
    }
];

export const LEVEL_2: LevelDefinition = {
    id: 2,
    title: 'Di Lapangan Sekolah',
    subtitle: 'Ujian Keadilan',
    assetPrefix: 'lv2',
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    groundY: GROUND_Y,
    player: {
        idleTexture: 'yudistira-olahraga',
        seatedTexture: 'yudistira-olahraga',
        walkRightTextures: [
            'yudistira-olahraga-langkah-kanan-1', 'yudistira-olahraga-langkah-kanan-2',
            'yudistira-olahraga-langkah-kanan-3', 'yudistira-olahraga-langkah-kanan-4'
        ],
        walkLeftTextures: [
            'yudistira-olahraga-langkah-kiri-1', 'yudistira-olahraga-langkah-kiri-2',
            'yudistira-olahraga-langkah-kiri-3', 'yudistira-olahraga-langkah-kiri-4'
        ],
        walkSpeed: 260,
        animFps: 9
    },
    segments: LV2_SEGMENTS,
    conclusionTitle: 'KESIMPULAN NILAI KEADILAN',
    conclusion:
        'Keadilan berarti kita berteman tanpa membeda-bedakan penampilan, membagi ' +
        'sesuatu dengan sama rata tanpa mementingkan diri sendiri, dan menyelesaikan ' +
        'masalah sesuai aturan yang benar. Bersikap adil membuat semua teman merasa ' +
        'dihargai dan disayangi!'
};

export const LEVELS: Record<number, LevelDefinition> = { 1: LEVEL_1, 2: LEVEL_2 };

export function speakersFor(levelId: number): Record<string, SpeakerStyle> {
    return levelId === 1 ? SPEAKERS_LV1 : SPEAKERS_LV2;
}
