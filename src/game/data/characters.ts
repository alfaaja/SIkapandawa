/** Intro karakter Pandawa — teks verbatim dari docs/data/NARRATIVE_LEVEL_01_02.json. */

export interface CharacterIntro {
    id: string;
    name: string;
    /** Texture panel perkenalan (bust + panel, teks tidak baked). */
    panelTexture: string;
    introText: string;
}

export const YUDHISTIRA_INTRO: CharacterIntro = {
    id: 'yudhistira',
    name: 'YUDISTIRA',
    panelTexture: 'lv1-perkenalan-yudistira',
    introText:
        'Halo, teman-teman! Namaku Yudistira, aku adalah anak sulung dari lima ' +
        'bersaudara yang biasa dipanggil Pandawa. Aku sangat suka kedamaian, tidak ' +
        'suka berbohong, dan selalu berusaha adil kepada siapa saja. Di sekolah, aku ' +
        'akan mengajak kalian belajar bagaimana menjadi anak yang jujur dan sabar, ' +
        'meskipun keadaan di sekitar kita kadang terasa sulit. Yuk, temani aku di ' +
        'sekolah hari ini!'
};

export const BIMA_INTRO: CharacterIntro = {
    id: 'bima',
    name: 'BIMA',
    panelTexture: 'lv3-perkenalan-bima',
    introText:
        'Halo, teman-teman! Namaku Bima, aku adalah anak kedua dari Pandawa. ' +
        'Tubuhku memang paling besar dan kuat, tetapi kekuatan ini kugunakan ' +
        'untuk melindungi teman-teman. Aku sangat tidak suka perbuatan menindas ' +
        'dan pergaulan yang buruk. Yuk, ikuti perjalananku hari ini. Kita belajar ' +
        'menjadi anak yang berani membela kebenaran dan tegas menolak ajakan ' +
        'yang salah!'
};

export const CHARACTER_INTROS: Record<string, CharacterIntro> = {
    yudhistira: YUDHISTIRA_INTRO,
    bima: BIMA_INTRO
};
