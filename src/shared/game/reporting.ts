export interface ReportRank {
    name: string;
    message: string;
}

const MISSION_RANKS: ReadonlyArray<ReportRank & { minimumStars: number }> = [
    { minimumStars: 25, name: 'Ksatria Sejati', message: 'Nilai budi pekerti dipahami dengan sangat baik.' },
    { minimumStars: 19, name: 'Calon Ksatria Hebat', message: 'Pemahaman budi pekerti sudah baik dan terus berkembang.' },
    { minimumStars: 13, name: 'Teman yang Baik', message: 'Banyak perilaku baik sudah dipahami.' },
    { minimumStars: 7, name: 'Terus Belajar', message: 'Perjalanan belajar sudah dimulai dan perlu diteruskan.' },
    { minimumStars: 0, name: 'Awal Perjalanan', message: 'Pemain baru memulai perjalanan Sikapandawa.' }
];

export const LEVEL_REPORT_LABELS = [
    'Kejujuran',
    'Keadilan',
    'Keberanian',
    'Ketegasan bergaul',
    'Kesopanan diri',
    'Etika di sekolah',
    'Perilaku sesuai umur',
    'Kebiasaan sehat',
    'Tanggung jawab diri',
    'Kebersihan lingkungan'
] as const;

export function getMissionReportRank(totalStars: number): ReportRank {
    const normalized = Math.max(0, Math.min(30, Math.floor(totalStars)));
    return MISSION_RANKS.find((rank) => normalized >= rank.minimumStars)
        ?? MISSION_RANKS[MISSION_RANKS.length - 1];
}

export function getJejakReportTier(score: number): string {
    const normalized = Math.max(0, Math.min(10, Math.floor(score)));
    if (normalized >= 8) return 'Luar Biasa';
    if (normalized >= 5) return 'Bagus';
    return 'Jangan Menyerah';
}
