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

export const SPEAKERS_LV3: Record<string, SpeakerStyle> = {
    'bima': { displayName: 'Bima', textboxTexture: 'lv3-textboxt-bima' },
    'budi': { displayName: 'Budi', textboxTexture: 'lv3-textboxt-budi' },
    'edo': { displayName: 'Edo', textboxTexture: 'lv3-textboxt-edo' },
    'siti': { displayName: 'Siti', textboxTexture: 'lv3-textboxt-siti' },
    'ani': { displayName: 'Ani', textboxTexture: 'lv3-textboxt-ani' }
};

export const SPEAKERS_LV4: Record<string, SpeakerStyle> = {
    'bima': { displayName: 'Bima', textboxTexture: 'lv4-textboxt-bima' },
    'budi': { displayName: 'Budi', textboxTexture: 'lv4-textboxt-budi' },
    'edo': { displayName: 'Edo', textboxTexture: 'lv4-textboxt-edo' },
    'ibu-kantin': { displayName: 'Ibu Kantin', textboxTexture: 'lv4-textboxt-ibu-kantin' }
};

const BIMA_PLAYER = {
    idleTexture: 'bima',
    seatedTexture: 'bima',
    walkRightTextures: [
        'bima-langkah-kanan-1', 'bima-langkah-kanan-2',
        'bima-langkah-kanan-3', 'bima-langkah-kanan-4'
    ],
    walkLeftTextures: [
        'bima-langkah-kiri-1', 'bima-langkah-kiri-2',
        'bima-langkah-kiri-3', 'bima-langkah-kiri-4'
    ],
    walkSpeed: 260,
    animFps: 9
};

const LV3_SEGMENTS: SegmentDefinition[] = [
    {
        id: 'lv3-event-1',
        order: 1,
        title: 'Membela Siti dari Pemalakan',
        spawnX: 95,
        initialCameraX: 0,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: [{ id: 'pemalakan', texture: 'edo-budi-siti', x: 960, depth: 6 }],
        objects: [],
        interactions: [{
            id: 'lv3-s1-pemalakan',
            order: 1,
            triggerX: 960,
            markerY: 255,
            interactionRadius: 110,
            dialog: [
                { speaker: 'budi', text: 'Eh, Siti, bagi uang jajanmu, dong. Kamu kan punya banyak uang.' },
                { speaker: 'siti', text: 'Uang ini mau kupakai untuk membeli jajanku sendiri.' },
                { speaker: 'edo', text: 'Jangan pelit begitu sama teman!' }
            ],
            question: {
                choices: [
                    { id: 'A', text: 'Pura-pura tidak melihat dan pergi bermain ke tempat lain karena takut dimusuhi.' },
                    { id: 'B', text: 'Mendekati mereka, menyemangati Budi dan Edo, lalu ikut meminta uang Siti.' },
                    { id: 'C', text: 'Mendekati mereka, berdiri melindungi Siti, dan menegur Budi serta Edo dengan tegas.' }
                ],
                correctChoiceId: 'C',
                feedback: {
                    A: { speaker: 'siti', correct: false, text: 'Bima, aku membutuhkan pertolongan. Membiarkan teman dipaksa bukan tindakan yang berani.' },
                    B: { speaker: 'siti', correct: false, text: 'Bima, ikut meminta uang berarti kamu juga menindas. Gunakan kekuatanmu untuk melindungi teman, bukan menyakiti.' },
                    C: { speaker: 'siti', correct: true, text: 'Terima kasih, Bima! Kamu berani melindungiku dan menegur mereka dengan tegas.' }
                }
            }
        }],
        exitX: EXIT_X
    },
    {
        id: 'lv3-event-2',
        order: 2,
        title: 'Menghentikan Edo Melempari Kucing',
        spawnX: 95,
        initialCameraX: 0,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: [{ id: 'lempar-kucing', texture: 'lempar-kucing', x: 930, depth: 6 }],
        objects: [],
        interactions: [{
            id: 'lv3-s2-kucing',
            order: 1,
            triggerX: 930,
            markerY: 260,
            interactionRadius: 110,
            dialog: [
                { speaker: 'bima', text: 'Hei, Edo, kamu sedang apa?' },
                { speaker: 'edo', text: 'Seru, Bim. Aku sedang melempari kucing dengan batu.' }
            ],
            question: {
                choices: [
                    { id: 'A', text: 'Mendekati Edo dan menegurnya dengan tegas agar berhenti menyakiti makhluk hidup.' },
                    { id: 'B', text: 'Mengambil batu yang lebih besar dan ikut melempari kucing karena terlihat seru.' },
                    { id: 'C', text: 'Berdiri menonton sambil tertawa melihat kucing itu berlari ketakutan.' }
                ],
                correctChoiceId: 'A',
                feedback: {
                    A: { speaker: 'edo', correct: true, text: 'Maafkan aku, Bima. Kamu benar, hewan juga bisa merasakan sakit. Aku tidak akan mengulanginya lagi.' },
                    B: { speaker: 'bima', correct: false, text: 'Aku tidak boleh ikut menyakiti kucing. Hewan juga bisa merasakan sakit.' },
                    C: { speaker: 'bima', correct: false, text: 'Menertawakan hewan yang ketakutan juga tidak baik. Aku harus menghentikan perbuatan itu.' }
                }
            }
        }],
        exitX: EXIT_X
    },
    {
        id: 'lv3-event-3',
        order: 3,
        title: 'Membela Ani yang Diejek',
        spawnX: 95,
        initialCameraX: 0,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: [{ id: 'bully-sepatu', texture: 'bully-sepatu', x: 1005, depth: 6 }],
        objects: [],
        interactions: [{
            id: 'lv3-s3-sepatu',
            order: 1,
            triggerX: 1005,
            markerY: 260,
            interactionRadius: 115,
            dialog: [{ speaker: 'edo', text: 'Yah, sepatunya jelek dan sudah rusak!' }],
            question: {
                choices: [
                    { id: 'A', text: 'Ikut mengejek sepatu Ani agar Edo dan Budi menganggap Bima sebagai teman yang asyik.' },
                    { id: 'B', text: 'Membela Ani dengan mengatakan bahwa semangat belajarnya lebih penting, lalu meminta Edo dan Budi berhenti mengejek.' },
                    { id: 'C', text: 'Marah besar dan memukul Edo serta Budi sampai menangis.' }
                ],
                correctChoiceId: 'B',
                feedback: {
                    A: { speaker: 'ani', correct: false, text: 'Aku sedih, Bima. Mengikuti ejekan hanya akan membuat orang lain semakin terluka.' },
                    B: { speaker: 'ani', correct: true, text: 'Terima kasih, Bima. Kata-katamu membuatku kembali semangat. Walaupun sepatuku rusak, aku akan tetap rajin belajar!' },
                    C: { speaker: 'ani', correct: false, text: 'Bima, membela kebenaran itu baik, tetapi memukul teman juga tidak dibenarkan. Tegurlah dengan baik dan tegas.' }
                }
            }
        }],
        exitX: EXIT_X
    }
];

export const LEVEL_3: LevelDefinition = {
    id: 3,
    title: 'Di Halaman Sekolah',
    subtitle: 'Ujian Keberanian Membela yang Benar',
    assetPrefix: 'lv3',
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    groundY: GROUND_Y,
    player: BIMA_PLAYER,
    segments: LV3_SEGMENTS,
    conclusionTitle: 'KESIMPULAN NILAI KEBERANIAN',
    conclusion:
        'Berani bukan berarti suka berkelahi. Keberanian sejati adalah saat kita ' +
        'menggunakan kekuatan dan suara untuk melindungi mereka yang lemah, ' +
        'membela teman yang benar, dan menghentikan perbuatan buruk di sekitar kita.',
    introCharacterId: 'bima'
};

const LV4_SEGMENTS: SegmentDefinition[] = [
    {
        id: 'lv4-event-1',
        order: 1,
        title: 'Menolak Ajakan Bolos',
        spawnX: 95,
        initialCameraX: 0,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: [{ id: 'budi-edo', texture: 'budi-edo', x: 920, depth: 6 }],
        objects: [],
        interactions: [{
            id: 'lv4-s1-bolos',
            order: 1,
            triggerX: 920,
            markerY: 255,
            interactionRadius: 110,
            dialog: [
                { speaker: 'edo', text: 'Eh, Bima, ayo kita bolos saja. Pusing terus belajar di kelas!' },
                { speaker: 'bima', text: 'Wah, ternyata kalian mau bolos.' }
            ],
            question: {
                choices: [
                    { id: 'A', text: 'Mengangguk setuju dan ikut membolos.' },
                    { id: 'B', text: 'Menolak dengan tegas, menasihati Edo dan Budi bahwa bolos merugikan masa depan, lalu kembali ke kelas.' },
                    { id: 'C', text: 'Mengancam akan memukul Edo dan Budi jika mereka mengajak bolos lagi.' }
                ],
                correctChoiceId: 'B',
                feedback: {
                    A: { speaker: 'ibu-kantin', correct: false, text: 'Bima, ikut membolos akan membuatmu kehilangan pelajaran. Pilihlah teman dan tindakan yang membawa kebaikan.' },
                    B: { speaker: 'ibu-kantin', correct: true, text: 'Keputusan yang bagus, Bima. Menolak ajakan bolos menunjukkan bahwa kamu memiliki pendirian yang kuat.' },
                    C: { speaker: 'ibu-kantin', correct: false, text: 'Tegas menolak itu baik, tetapi mengancam teman dengan kekerasan bukan sikap seorang ksatria.' }
                }
            }
        }],
        exitX: EXIT_X
    },
    {
        id: 'lv4-event-2',
        order: 2,
        title: 'Mencegah Pencurian Jajanan',
        spawnX: 95,
        initialCameraX: 0,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: [{ id: 'budi-edo', texture: 'budi-edo', x: 920, depth: 6 }],
        objects: [],
        interactions: [{
            id: 'lv4-s2-jajanan',
            order: 1,
            triggerX: 920,
            markerY: 255,
            interactionRadius: 110,
            dialog: [{ speaker: 'budi', text: 'Eh, Bima, ayo kita ambil jajanan ini. Kebetulan tidak ada yang menjaga.' }],
            question: {
                choices: [
                    { id: 'A', text: 'Menolak dengan tegas, menjelaskan bahwa mengambil tanpa izin adalah perbuatan salah, dan mencegah mereka mencuri.' },
                    { id: 'B', text: 'Ikut mengambil satu roti karena mengira Ibu Kantin tidak akan menyadarinya.' },
                    { id: 'C', text: 'Pura-pura tidak mendengar dan membiarkan Budi serta Edo mengambil makanan.' }
                ],
                correctChoiceId: 'A',
                feedback: {
                    A: { speaker: 'ibu-kantin', correct: true, text: 'Ibu mendengar semuanya dari belakang. Bima, kamu hebat karena tegas menolak dan mencegah teman mengambil barang tanpa izin.' },
                    B: { speaker: 'ibu-kantin', correct: false, text: 'Berapa pun jumlahnya, mengambil barang tanpa izin adalah perbuatan yang salah.' },
                    C: { speaker: 'ibu-kantin', correct: false, text: 'Membiarkan teman mengambil barang tanpa izin padahal kamu dapat mencegahnya bukan tindakan yang benar.' }
                }
            }
        }],
        exitX: EXIT_X
    },
    {
        id: 'lv4-event-3',
        order: 3,
        title: 'Menghentikan Vandalisme',
        spawnX: 95,
        initialCameraX: 0,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: [{ id: 'budi-coret', texture: 'budi-coret', x: 850, depth: 6 }],
        objects: [{ id: 'coretan', texture: 'coretan', x: 850, y: 405, centered: true, depth: 5 }],
        interactions: [{
            id: 'lv4-s3-vandalisme',
            order: 1,
            triggerX: 850,
            markerY: 255,
            interactionRadius: 110,
            dialog: [
                { speaker: 'bima', text: 'Budi, kenapa kamu mencoret tembok kantin?' },
                { speaker: 'budi', text: 'Biar terlihat keren. Gambarku bagus, kan, Bim?' }
            ],
            question: {
                choices: [
                    { id: 'A', text: 'Mengambil spidol dan menulis nama Bima dengan huruf besar di tembok.' },
                    { id: 'B', text: 'Mengambil spidol lalu mencoret wajah Budi dan Edo agar mereka kapok.' },
                    { id: 'C', text: 'Menolak ikut mencoret dan meminta mereka membersihkan coretan karena merusak fasilitas sekolah.' }
                ],
                correctChoiceId: 'C',
                feedback: {
                    A: { speaker: 'ibu-kantin', correct: false, text: 'Bima, tembok ini dirawat bersama. Jangan ikut merusak fasilitas sekolah.' },
                    B: { speaker: 'ibu-kantin', correct: false, text: 'Mencoret wajah teman akan memicu pertengkaran. Tegaslah dengan kata-kata, bukan dengan membalas secara jahil.' },
                    C: { speaker: 'budi', correct: true, text: 'Baik, Bima. Kami salah dan akan membersihkan coretan ini sekarang.' }
                }
            }
        }],
        exitX: EXIT_X
    }
];

export const LEVEL_4: LevelDefinition = {
    id: 4,
    title: 'Area Kantin',
    subtitle: 'Ujian Ketegasan Menolak Ajakan Buruk',
    assetPrefix: 'lv4',
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    groundY: GROUND_Y,
    player: BIMA_PLAYER,
    segments: LV4_SEGMENTS,
    conclusionTitle: 'KESIMPULAN NILAI KETEGASAN BERGAUL',
    conclusion:
        'Teman yang baik akan mengajak pada kebaikan. Kita harus memiliki pendirian ' +
        'yang kuat. Jangan takut dianggap tidak keren hanya karena menolak ajakan ' +
        'bolos, merusak, atau mencuri. Berani berkata "tidak" pada hal buruk adalah ' +
        'bukti anak yang tangguh.'
};

export const SPEAKERS_LV5: Record<string, SpeakerStyle> = {
    'arjuna': { displayName: 'Arjuna', textboxTexture: 'lv5-textboxt-arjuna' },
    'ibu': { displayName: 'Ibu', textboxTexture: 'lv5-textboxt-ibu' }
};

export const SPEAKERS_LV6: Record<string, SpeakerStyle> = {
    'arjuna': { displayName: 'Arjuna', textboxTexture: 'lv6-textboxt-arjuna' },
    'budi': { displayName: 'Budi', textboxTexture: 'lv6-textboxt-budi' },
    'siti': { displayName: 'Siti', textboxTexture: 'lv6-textboxt-siti' },
    'pak-guru': { displayName: 'Pak Guru', textboxTexture: 'lv6-textboxt-pak-guru' }
};

const ARJUNA_PLAYER_LV5 = {
    idleTexture: 'arjuna',
    seatedTexture: 'arjuna',
    walkRightTextures: [
        'arjuna-langkah-kanan-1', 'arjuna-langkah-kanan-2',
        'arjuna-langkah-kanan-3', 'arjuna-langkah-kanan-4'
    ],
    walkLeftTextures: [
        'arjuna-langkah-kiri-1', 'arjuna-langkah-kiri-2',
        'arjuna-langkah-kiri-3', 'arjuna-langkah-kiri-4'
    ],
    walkSpeed: 260,
    animFps: 9
};

const LV5_SEGMENTS: SegmentDefinition[] = [
    {
        id: 'lv5-event-1',
        order: 1,
        title: 'Berpakaian Rapi',
        spawnX: 95,
        initialCameraX: 0,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: [],
        objects: [],
        interactions: [{
            id: 'lv5-s1-lemari',
            order: 1,
            triggerX: 1285,
            markerY: 220,
            interactionRadius: 100,
            dialog: [{ speaker: 'arjuna', text: 'Apa aku pakai kaos tengkorak saja, ya?' }],
            question: {
                choices: [
                    { id: 'A', text: 'Memakai kaos oblong bergambar tengkorak ke sekolah karena dianggap keren.' },
                    { id: 'B', text: 'Memakai seragam merah putih dengan rapi, mengancingkan baju, memasukkannya ke celana, dan menyisir rambut.' },
                    { id: 'C', text: 'Memakai seragam tetapi membiarkan kancing terbuka dan baju tidak rapi.' }
                ],
                correctChoiceId: 'B',
                feedback: {
                    A: { speaker: 'ibu', correct: false, text: 'Arjuna, sekolah memiliki aturan berpakaian. Gunakanlah seragam yang rapi agar kamu siap belajar.' },
                    B: { speaker: 'ibu', correct: true, text: 'Wah, Arjuna rapi sekali! Berpakaian sopan berarti kamu menghargai diri sendiri dan sekolahmu.' },
                    C: { speaker: 'ibu', correct: false, text: 'Seragam yang dikenakan dengan rapi membuatmu nyaman dan menunjukkan bahwa kamu menghargai aturan sekolah.' }
                }
            }
        }],
        exitX: EXIT_X
    },
    {
        id: 'lv5-event-2',
        order: 2,
        title: 'Berpamitan',
        spawnX: 95,
        initialCameraX: 0,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: [{ id: 'ibu', texture: 'ibu', x: 680, y: 520, depth: 6 }],
        objects: [],
        interactions: [{
            id: 'lv5-s2-ibu',
            order: 1,
            triggerX: 680,
            markerY: 205,
            interactionRadius: 105,
            dialog: [{ speaker: 'ibu', text: 'Arjuna, kamu sudah mau berangkat, Nak?' }],
            question: {
                choices: [
                    { id: 'A', text: 'Berteriak dari luar pagar sambil terus berlari.' },
                    { id: 'B', text: 'Pergi diam-diam tanpa berpamitan.' },
                    { id: 'C', text: 'Mendekati Ibu, mencium tangan, mengucapkan salam, dan meminta doa.' }
                ],
                correctChoiceId: 'C',
                feedback: {
                    A: { speaker: 'ibu', correct: false, text: 'Berpamitan sebaiknya dilakukan dengan mendekat dan berbicara dengan sopan, bukan berteriak dari jauh.' },
                    B: { speaker: 'ibu', correct: false, text: 'Pergi tanpa berpamitan membuat Ibu khawatir. Berpamitan adalah adab yang baik.' },
                    C: { speaker: 'ibu', correct: true, text: 'Waalaikumsalam. Hati-hati di jalan, Arjuna. Doa Ibu selalu menyertaimu.' }
                }
            }
        }],
        exitX: EXIT_X
    },
    {
        id: 'lv5-event-3',
        order: 3,
        title: 'Bersyukur atas Uang Saku',
        spawnX: 95,
        initialCameraX: 0,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: [{ id: 'ibu', texture: 'ibu', x: 680, y: 520, depth: 6 }],
        objects: [],
        interactions: [{
            id: 'lv5-s3-ibu',
            order: 1,
            triggerX: 680,
            markerY: 205,
            interactionRadius: 105,
            dialog: [{ speaker: 'ibu', text: 'Arjuna, ini uang saku untuk kamu, ya.' }],
            question: {
                choices: [
                    { id: 'A', text: 'Menolak karena jumlah uang saku dianggap terlalu sedikit.' },
                    { id: 'B', text: 'Menerima dan mengucapkan terima kasih.' },
                    { id: 'C', text: 'Menerima, tetapi mengeluh karena jumlahnya tidak banyak.' }
                ],
                correctChoiceId: 'B',
                feedback: {
                    A: { speaker: 'ibu', correct: false, text: 'Menolak pemberian hanya karena jumlahnya sedikit menunjukkan bahwa kita belum bersyukur.' },
                    B: { speaker: 'ibu', correct: true, text: 'Sama-sama, Arjuna. Gunakan uangnya dengan bijak dan sisihkan sebagian untuk menabung.' },
                    C: { speaker: 'ibu', correct: false, text: 'Menerima sambil mengeluh dapat menyakiti hati orang yang memberi. Belajarlah menerima dengan rasa syukur.' }
                }
            }
        }],
        exitX: EXIT_X
    }
];

export const LEVEL_5: LevelDefinition = {
    id: 5,
    title: 'Rumah dan Berangkat Sekolah',
    subtitle: 'Kesopanan Diri',
    assetPrefix: 'lv5',
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    groundY: GROUND_Y,
    player: ARJUNA_PLAYER_LV5,
    segments: LV5_SEGMENTS,
    conclusionTitle: 'KESIMPULAN NILAI KESOPANAN DIRI',
    conclusion:
        'Menjadi anak yang sopan dimulai dari diri sendiri. Berpakaian rapi sesuai ' +
        'tempatnya, berpamitan, menghormati orang tua, dan bersyukur atas pemberian ' +
        'adalah sikap yang membuat kita dihormati dan disayangi.',
    introCharacterId: 'arjuna'
};

const LV6_KID_SEATS = [320, 535, 755, 970];
const LV6_PLAYER_SEAT = 1190;
const LV6_TEACHER_SEAT = 1415;

function lv6Furniture(tableTexture: string): ObjectPlacement[] {
    const objects: ObjectPlacement[] = [
        { id: 'meja-kelas', texture: tableTexture, x: 780, y: GROUND_Y, depth: 8 }
    ];
    [...LV6_KID_SEATS, LV6_PLAYER_SEAT].forEach((x, i) => {
        objects.push({ id: `kursi-siswa-${i}`, texture: 'kursi-siswa', x, y: GROUND_Y, depth: 4 });
    });
    objects.push({
        id: 'kursi-guru',
        texture: 'kursi-guru',
        x: LV6_TEACHER_SEAT,
        y: GROUND_Y,
        depth: 4
    });
    return objects;
}

const LV6_CLASS_ACTORS = [
    { id: 'budi', texture: 'budi-duduk', x: LV6_KID_SEATS[0], depth: 6 },
    { id: 'edo', texture: 'edo-duduk', x: LV6_KID_SEATS[1], depth: 6 },
    { id: 'siti', texture: 'siti-duduk', x: LV6_KID_SEATS[2], depth: 6 },
    { id: 'ani', texture: 'ani-duduk', x: LV6_KID_SEATS[3], depth: 6 },
    { id: 'pak-guru', texture: 'pak-guru-duduk', x: LV6_TEACHER_SEAT, depth: 6 }
];

const ARJUNA_PLAYER_LV6 = {
    idleTexture: 'arjuna',
    seatedTexture: 'arjuna-duduk',
    walkRightTextures: [
        'arjuna-langkah-kanan-1', 'arjuna-langkah-kanan-2',
        'arjuna-langkah-kanan-3', 'arjuna-langkah-kanan-4'
    ],
    walkLeftTextures: [
        'arjuna-langkah-kiri-1', 'arjuna-langkah-kiri-2',
        'arjuna-langkah-kiri-3', 'arjuna-langkah-kiri-4'
    ],
    walkSpeed: 260,
    animFps: 9
};

const LV6_SEGMENTS: SegmentDefinition[] = [
    {
        id: 'lv6-event-1',
        order: 1,
        title: 'Meminta Maaf',
        spawnX: 95,
        initialCameraX: 0,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: LV6_CLASS_ACTORS.map((actor) => ({ ...actor })),
        objects: [
            ...lv6Furniture('meja-buku'),
            {
                id: 'meja-kelas-tumpah',
                texture: 'meja-buku-tumpah',
                x: 780,
                y: GROUND_Y,
                depth: 8,
                hidden: true
            }
        ],
        interactions: [
            {
                id: 'lv6-s1-duduk',
                order: 1,
                triggerX: LV6_PLAYER_SEAT,
                markerY: 310,
                interactionRadius: 80,
                sitAtX: LV6_PLAYER_SEAT,
                onStartHideObjects: ['meja-kelas'],
                onStartShowObjects: ['meja-kelas-tumpah'],
                dialog: [{
                    speaker: 'siti',
                    text: 'Arjuna, tadi kamu membuat bukuku basah karena gelas airku tersenggol.'
                }]
            },
            {
                id: 'lv6-s1-tumpah',
                order: 2,
                triggerX: LV6_KID_SEATS[2],
                markerY: 355,
                interactionRadius: 100,
                dialog: [],
                question: {
                    choices: [
                        { id: 'A', text: 'Meminta maaf dan bersedia bertanggung jawab.' },
                        { id: 'B', text: 'Diam tanpa merespons.' },
                        { id: 'C', text: 'Marah karena merasa tidak sengaja.' }
                    ],
                    correctChoiceId: 'A',
                    feedback: {
                        A: { speaker: 'pak-guru', correct: true, text: 'Bagus, Arjuna. Walaupun tidak sengaja, meminta maaf dan bertanggung jawab adalah sikap terpuji.' },
                        B: { speaker: 'pak-guru', correct: false, text: 'Diam saja tidak menyelesaikan masalah. Sampaikan permintaan maaf dan bantu memperbaiki keadaan.' },
                        C: { speaker: 'pak-guru', correct: false, text: 'Jangan marah saat diminta bertanggung jawab. Permintaan maaf yang tulus sangat berarti.' }
                    }
                }
            }
        ],
        exitX: EXIT_X
    },
    {
        id: 'lv6-event-2',
        order: 2,
        title: 'Menjaga Tutur Kata',
        spawnX: 95,
        initialCameraX: 0,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: LV6_CLASS_ACTORS.map((actor) => ({ ...actor })),
        objects: lv6Furniture('meja'),
        interactions: [{
            id: 'lv6-s2-budi',
            order: 1,
            triggerX: LV6_KID_SEATS[1],
            markerY: 305,
            interactionRadius: 100,
            dialog: [{
                speaker: 'budi',
                text: 'Eh, Arjuna, anjay, keren banget gaya rambut kamu hari ini!'
            }],
            question: {
                choices: [
                    { id: 'A', text: 'Mengulang kata tidak sopan yang digunakan Budi.' },
                    { id: 'B', text: 'Hanya mengucapkan terima kasih lalu pergi.' },
                    { id: 'C', text: 'Mengucapkan terima kasih dan mengingatkan Budi dengan baik.' }
                ],
                correctChoiceId: 'C',
                feedback: {
                    A: { speaker: 'pak-guru', correct: false, text: 'Kata-kata yang tidak sopan sebaiknya tidak diulang.' },
                    B: { speaker: 'pak-guru', correct: false, text: 'Mengucapkan terima kasih itu baik, tetapi kamu juga dapat mengingatkan teman dengan sopan.' },
                    C: { speaker: 'pak-guru', correct: true, text: 'Bapak bangga, Arjuna. Kamu mengingatkan teman dengan cara yang baik.' }
                }
            }
        }],
        exitX: EXIT_X
    },
    {
        id: 'lv6-event-3',
        order: 3,
        title: 'Meminta Izin',
        spawnX: 95,
        initialCameraX: 0,
        minPlayerX: 54,
        maxPlayerX: 1646,
        actors: LV6_CLASS_ACTORS.map((actor) => ({ ...actor })),
        objects: [
            ...lv6Furniture('meja'),
            { id: 'penghapus', texture: 'penghapus', x: LV6_TEACHER_SEAT, y: 405, centered: true, depth: 9 }
        ],
        interactions: [
            {
                id: 'lv6-s3-duduk',
                order: 1,
                triggerX: LV6_PLAYER_SEAT,
                markerY: 310,
                interactionRadius: 80,
                sitAtX: LV6_PLAYER_SEAT,
                dialog: [
                    { speaker: 'pak-guru', text: 'Anak-anak, jangan lupa alat tulisnya dipersiapkan, ya.' },
                    { speaker: 'arjuna', text: 'Waduh, aku tidak membawa penghapus. Apa aku pinjam punya Pak Guru, ya?' }
                ]
            },
            {
                id: 'lv6-s3-penghapus',
                order: 2,
                triggerX: LV6_TEACHER_SEAT,
                markerY: 350,
                interactionRadius: 90,
                dialog: [],
                question: {
                    choices: [
                        { id: 'A', text: 'Langsung mengambil penghapus tanpa meminta izin.' },
                        { id: 'B', text: 'Meminta izin sebelum meminjam penghapus.' },
                        { id: 'C', text: 'Mengambil dahulu lalu meminta izin setelah selesai.' }
                    ],
                    correctChoiceId: 'B',
                    feedback: {
                        A: { speaker: 'pak-guru', correct: false, text: 'Mengambil barang tanpa izin tidak boleh dilakukan. Mintalah izin sebelum meminjam.' },
                        B: { speaker: 'pak-guru', correct: true, text: 'Tentu, Arjuna. Bapak senang kamu meminta izin terlebih dahulu.' },
                        C: { speaker: 'pak-guru', correct: false, text: 'Izin harus diminta sebelum barang digunakan, bukan setelah selesai.' }
                    }
                },
                onResolveHideObjects: ['penghapus']
            }
        ],
        exitX: EXIT_X
    }
];

export const LEVEL_6: LevelDefinition = {
    id: 6,
    title: 'Kelas Sekolah',
    subtitle: 'Kesopanan di Sekolah',
    assetPrefix: 'lv6',
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    groundY: GROUND_Y,
    player: ARJUNA_PLAYER_LV6,
    segments: LV6_SEGMENTS,
    conclusionTitle: 'KESIMPULAN NILAI ETIKA',
    conclusion:
        'Sopan santun dapat dipahami oleh semua orang. Bertutur kata baik, meminta ' +
        'maaf saat melakukan kesalahan, menghormati orang lain, dan meminta izin ' +
        'sebelum meminjam menunjukkan bahwa kita adalah anak yang beretika.'
};

export const LEVELS: Record<number, LevelDefinition> = {
    1: LEVEL_1,
    2: LEVEL_2,
    3: LEVEL_3,
    4: LEVEL_4,
    5: LEVEL_5,
    6: LEVEL_6
};

const SPEAKERS_BY_LEVEL: Record<number, Record<string, SpeakerStyle>> = {
    1: SPEAKERS_LV1,
    2: SPEAKERS_LV2,
    3: SPEAKERS_LV3,
    4: SPEAKERS_LV4,
    5: SPEAKERS_LV5,
    6: SPEAKERS_LV6
};

export function speakersFor(levelId: number): Record<string, SpeakerStyle> {
    return SPEAKERS_BY_LEVEL[levelId] ?? SPEAKERS_LV1;
}
