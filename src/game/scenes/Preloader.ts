import { Scene, GameObjects } from 'phaser';
import { addBackground, applyLogicalCamera, DESIGN_WIDTH } from '../ui/backdrop';
import { makeText } from '../ui/fonts';

const BAR_WIDTH = 420;
const BAR_HEIGHT = 16;
const BAR_Y = 672;
const HOLD_AFTER_LOAD_MS = 600;
const FADE_MS = 300;

/** Aset gameplay bersama untuk kedua level (nama file identik per folder). */
const GAMEPLAY_SHARED = [
    'bg', 'bintang-hasil-abu', 'bintang-hasil', 'bintang-kebaikan', 'box-menu',
    'label-sikapandawa', 'level-nama', 'pilihan', 'tanda-panah',
    'teksboxt-kesimpulan', 'tombol-aksi', 'tombol-back', 'tombol-kanan',
    'tombol-kiri', 'tombol-mute', 'tombol-next', 'tombol-pause-game',
    'tombol-play-game', 'tombol-play', 'tombol-quit', 'tombol-replay',
    'tombol-unmute'
];

const GAMEPLAY_LV1 = [
    'ani-duduk', 'budi-duduk', 'edo-duduk', 'siti-duduk', 'pak-guru-duduk',
    'gumpalan-kertas', 'koin', 'kursi-guru', 'kursi-siswa', 'meja-single',
    'perkenalan-yudistira', 'textboxt-budi', 'textboxt-edo', 'textboxt-pak-guru',
    'vas-jatuh', 'vas', 'yudistira-duduk', 'yudistira-tegap',
    'yudistira-langkah-kanan-1', 'yudistira-langkah-kanan-2',
    'yudistira-langkah-kanan-3', 'yudistira-langkah-kanan-4',
    'yudistira-langkah-kiri-1', 'yudistira-langkah-kiri-2',
    'yudistira-langkah-kiri-3', 'yudistira-langkah-kiri-4'
];

const GAMEPLAY_LV2 = [
    'ani-olahraga-kanan', 'ani-olahraga-kiri', 'berebut-bola',
    'budi-olahraga-kanan', 'budi-olahraga-kiri', 'budi-olahraga-marah',
    'edo-olahraga-kiri', 'meja-botol', 'pak-guru-olahraga',
    'siti-olahraga-kiri', 'siti-olahraga-marah',
    'textbox-ani-olahraga', 'textbox-budi-olahraga', 'textbox-siti-olahraga',
    'textbox-yudistira-olahraga', 'textboxt-pak-guru-olagraga',
    'yudistira-olahraga', 'yudistira-olahraga-kanan', 'yudistira-olahraga-kiri',
    'yudistira-olahraga-langkah-kanan-1', 'yudistira-olahraga-langkah-kanan-2',
    'yudistira-olahraga-langkah-kanan-3', 'yudistira-olahraga-langkah-kanan-4',
    'yudistira-olahraga-langkah-kiri-1', 'yudistira-olahraga-langkah-kiri-2',
    'yudistira-olahraga-langkah-kiri-3', 'yudistira-olahraga-langkah-kiri-4'
];

const GAMEPLAY_LV3 = [
    'bima', 'bima-langkah-kanan-1', 'bima-langkah-kanan-2',
    'bima-langkah-kanan-3', 'bima-langkah-kanan-4', 'bima-langkah-kiri-1',
    'bima-langkah-kiri-2', 'bima-langkah-kiri-3', 'bima-langkah-kiri-4',
    'bully-sepatu', 'edo-budi-siti', 'lempar-kucing', 'perkenalan-bima',
    'textboxt-ani', 'textboxt-bima', 'textboxt-budi', 'textboxt-edo',
    'textboxt-siti'
];

const GAMEPLAY_LV4 = [
    'bima', 'bima-langkah-kanan-1', 'bima-langkah-kanan-2',
    'bima-langkah-kanan-3', 'bima-langkah-kanan-4', 'bima-langkah-kiri-1',
    'bima-langkah-kiri-2', 'bima-langkah-kiri-3', 'bima-langkah-kiri-4',
    'budi-coret', 'budi-edo', 'coretan', 'textboxt-bima', 'textboxt-budi',
    'textboxt-edo', 'textboxt-ibu-kantin'
];

/**
 * Preloader — Loading/Splash dalam satu flow:
 * splash tampil → progress asli + persentase → 100% → indikator hilang
 * → tahan sejenak → fade ke MainMenu.
 */
export class Preloader extends Scene {
    private percentText: GameObjects.Text;
    private barFill: GameObjects.Rectangle;
    private barFrame: GameObjects.Rectangle;
    private failedFiles: string[] = [];

    constructor() {
        super('Preloader');
    }

    init(): void {
        applyLogicalCamera(this);
        addBackground(this, 'bg-splash');

        const cx = DESIGN_WIDTH / 2;
        this.barFrame = this.add.rectangle(cx, BAR_Y, BAR_WIDTH, BAR_HEIGHT)
            .setStrokeStyle(4, 0x630995)
            .setFillStyle(0xffffff, 0.9);
        this.barFill = this.add.rectangle(cx - BAR_WIDTH / 2 + 2, BAR_Y, 4, BAR_HEIGHT - 6, 0x9441c0)
            .setOrigin(0, 0.5);
        this.percentText = makeText(this, cx, BAR_Y - 34, '0%', 16, { color: '#630995' })
            .setOrigin(0.5);

        this.load.on('progress', (progress: number) => {
            this.barFill.width = Math.max(4, (BAR_WIDTH - 4) * progress);
            this.percentText.setText(`${Math.round(progress * 100)}%`);
        });
        this.load.on('loaderror', (file: Phaser.Loader.File) => {
            this.failedFiles.push(file.key);
        });
    }

    preload(): void {
        this.load.setPath('assets/frontend');

        // Auth (MainMenu, Register, Login)
        this.load.image('bg-panel-empty', 'auth/bg-panel-empty.png');
        this.load.image('logo-panel', 'auth/logo-panel.png');
        this.load.image('button-daftar', 'auth/button-daftar.png');
        this.load.image('button-masuk', 'auth/button-masuk.png');
        this.load.image('textbox-daftar', 'auth/textbox-daftar.png');
        this.load.image('textbox-masuk', 'auth/textbox-masuk.png');

        // Level Select
        this.load.image('bg-level', 'level-select/bg-level.png');
        this.load.image('panel-user', 'level-select/panel-user.png');
        this.load.image('label-misi', 'level-select/label-misi.png');
        this.load.image('label-sikapandawa', 'level-select/label-sikapandawa.png');
        this.load.image('button-logout', 'level-select/button-logout.png');
        for (let level = 1; level <= 10; level++) {
            this.load.image(`level-${level}-unlocked`, `level-select/level-${level}-unlocked.png`);
            if (level >= 2) {
                this.load.image(`level-${level}-locked`, `level-select/level-${level}-locked.png`);
            }
        }
        this.load.image('jejak-locked', 'level-select/jejak-locked.png');

        // Gameplay Level 1-2
        this.load.setPath('assets/gameplay');
        for (const name of [...GAMEPLAY_SHARED, ...GAMEPLAY_LV1]) {
            this.load.image(`lv1-${name}`, `lv1/${name}.png`);
        }
        for (const name of [...GAMEPLAY_SHARED, ...GAMEPLAY_LV2]) {
            this.load.image(`lv2-${name}`, `lv2/${name}.png`);
        }
        for (const name of [...GAMEPLAY_SHARED, ...GAMEPLAY_LV3]) {
            this.load.image(`lv3-${name}`, `lv3/${name}.png`);
        }
        for (const name of [...GAMEPLAY_SHARED, ...GAMEPLAY_LV4]) {
            this.load.image(`lv4-${name}`, `lv4/${name}.png`);
        }
    }

    create(): void {
        if (this.failedFiles.length > 0) {
            // Fallback: scene memakai Graphics pengganti; jangan biarkan layar hitam.
            console.warn('[Preloader] Asset gagal dimuat:', this.failedFiles.join(', '));
        }

        this.percentText.setText('100%');
        this.barFill.width = BAR_WIDTH - 4;

        this.time.delayedCall(150, () => {
            this.percentText.setVisible(false);
            this.barFill.setVisible(false);
            this.barFrame.setVisible(false);
        });

        this.time.delayedCall(150 + HOLD_AFTER_LOAD_MS, () => {
            this.cameras.main.fadeOut(FADE_MS, 255, 244, 214);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('MainMenu');
            });
        });
    }
}
