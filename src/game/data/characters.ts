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

export const ARJUNA_INTRO: CharacterIntro = {
    id: 'arjuna',
    name: 'ARJUNA',
    panelTexture: 'lv5-perkenalan-arjuna',
    introText:
        'Halo, teman-teman! Namaku Arjuna, anak ketiga atau penengah dari Pandawa. ' +
        'Aku sangat menyukai keindahan dan tutur kata yang lembut. Bagiku, anak ' +
        'yang hebat adalah anak yang berpakaian rapi dan selalu bertutur kata sopan. ' +
        'Yuk, temani aku hari ini. Kita buktikan bahwa bersikap sopan santun itu ' +
        'sangat keren!'
};

export const NAKULA_INTRO: CharacterIntro = {
    id: 'nakula',
    name: 'NAKULA',
    panelTexture: 'lv7-perkenalan-nakula',
    introText:
        'Halo, teman-teman! Namaku Nakula, anak keempat dari Pandawa. Aku sangat ' +
        'suka belajar dan bermain permainan yang seru. Bagiku, masa kanak-kanak ' +
        'adalah masa yang menyenangkan. Yuk, ikuti petualanganku untuk menjadi ' +
        'anak yang cerdas, sehat, dan bahagia!'
};

export const SADEWA_INTRO: CharacterIntro = {
    id: 'sadewa',
    name: 'SADEWA',
    panelTexture: 'lv9-perkenalan-sadewa',
    introText:
        'Halo, teman-teman! Namaku Sadewa, aku adalah anak bungsu atau adik ' +
        'terkecil Pandawa, kembaran Nakula. Walaupun paling kecil, aku sangat ' +
        'mandiri. Aku suka menjaga kebersihan, kesehatan, dan barang-barangku ' +
        'sendiri. Yuk, ikuti petualanganku untuk belajar menjadi anak yang ' +
        'bertanggung jawab dan mencintai kebersihan lingkungan!'
};

export const CHARACTER_INTROS: Record<string, CharacterIntro> = {
    yudhistira: YUDHISTIRA_INTRO,
    bima: BIMA_INTRO,
    arjuna: ARJUNA_INTRO,
    nakula: NAKULA_INTRO,
    sadewa: SADEWA_INTRO
};
