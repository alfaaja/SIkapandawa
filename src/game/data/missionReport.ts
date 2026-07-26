export interface MissionRank {
    minimumStars: number;
    name: string;
    message: string;
}

const MISSION_RANKS: MissionRank[] = [
    {
        minimumStars: 25,
        name: 'Ksatria Sejati',
        message: 'Sempurna. Nilai kejujuran, keadilan, keberanian, kesopanan, dan tanggung jawab telah kamu pahami dengan sangat baik.'
    },
    {
        minimumStars: 19,
        name: 'Calon Ksatria Hebat',
        message: 'Luar biasa. Kamu memahami nilai budi pekerti dengan baik. Sedikit latihan lagi akan membuatmu semakin hebat.'
    },
    {
        minimumStars: 13,
        name: 'Teman yang Baik',
        message: 'Bagus. Kamu sudah memahami banyak perilaku baik dan masih dapat berlatih pada beberapa bagian.'
    },
    {
        minimumStars: 7,
        name: 'Terus Belajar',
        message: 'Tetap semangat. Pelajari kembali jalan ksatria dan coba tingkatkan bintangmu.'
    },
    {
        minimumStars: 0,
        name: 'Awal Perjalanan',
        message: 'Jangan menyerah. Mainkan kembali misi untuk berlatih membedakan tindakan baik dan buruk.'
    }
];

export function getMissionRank(totalStars: number): MissionRank {
    const normalized = Math.max(0, Math.min(30, Math.floor(totalStars)));
    return MISSION_RANKS.find((rank) => normalized >= rank.minimumStars)
        ?? MISSION_RANKS[MISSION_RANKS.length - 1];
}
