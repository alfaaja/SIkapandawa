import { Scene, GameObjects } from 'phaser';
import { addBackground, DESIGN_WIDTH } from '../ui/backdrop';

const BAR_WIDTH = 420;
const BAR_HEIGHT = 16;
const BAR_Y = 672;
const HOLD_AFTER_LOAD_MS = 600;
const FADE_MS = 300;

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
        addBackground(this, 'bg-splash');

        const cx = DESIGN_WIDTH / 2;
        this.barFrame = this.add.rectangle(cx, BAR_Y, BAR_WIDTH, BAR_HEIGHT)
            .setStrokeStyle(4, 0x630995)
            .setFillStyle(0xffffff, 0.9);
        this.barFill = this.add.rectangle(cx - BAR_WIDTH / 2 + 2, BAR_Y, 4, BAR_HEIGHT - 6, 0x9441c0)
            .setOrigin(0, 0.5);
        this.percentText = this.add.text(cx, BAR_Y - 26, '0%', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#630995'
        }).setOrigin(0.5);

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
        this.load.image('level-1-unlocked', 'level-select/level-1-unlocked.png');
        for (let level = 2; level <= 10; level++) {
            this.load.image(`level-${level}-locked`, `level-select/level-${level}-locked.png`);
        }
        this.load.image('jejak-locked', 'level-select/jejak-locked.png');
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
