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

export const CHARACTER_INTROS: Record<string, CharacterIntro> = {
    yudhistira: YUDHISTIRA_INTRO
};
