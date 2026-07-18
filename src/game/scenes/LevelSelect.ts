import { Scene } from 'phaser';
import { addBackground, addImageIfExists } from '../ui/backdrop';
import { SpriteButton } from '../ui/SpriteButton';
import { MessageModal } from '../ui/MessageModal';
import { AuthStorageService } from '../services/AuthStorageService';
import { ProgressStorageService, TOTAL_LEVELS } from '../services/ProgressStorageService';

const GRID_XS = [380, 510, 640, 770, 900];
const GRID_ROW_YS = [240, 350];

/**
 * LevelSelect — panel user, total bintang, grid 10 level, Jejak Pandawa, logout.
 */
export class LevelSelect extends Scene {
    private modal: MessageModal;

    constructor() {
        super('LevelSelect');
    }

    create(): void {
        const account = AuthStorageService.getActiveAccount();
        if (!account) {
            // Tidak ada akun aktif (mis. storage dibersihkan) — kembali ke menu.
            this.scene.start('MainMenu');
            return;
        }

        this.cameras.main.fadeIn(250, 255, 244, 214);
        addBackground(this, 'bg-level');
        this.modal = new MessageModal(this);

        const progress = ProgressStorageService.getProgress(account.id);
        const totalStars = ProgressStorageService.totalStars(progress);

        // Panel user (kiri atas): nama pada kotak lavender, total bintang di area ungu.
        const panel = addImageIfExists(this, 18 + 190, 22 + 24, 'panel-user');
        if (!panel) {
            this.add.rectangle(208, 46, 380, 47, 0x630995).setStrokeStyle(3, 0x3a0a52);
        }
        const nameText = this.add.text(151, 45, account.displayName, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#3a0a52'
        }).setOrigin(0.5);
        if (nameText.width > 240) {
            nameText.setScale(240 / nameText.width);
        }
        this.add.text(367, 45, String(totalStars), {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Branding kanan atas + logout.
        addImageIfExists(this, 1090, 46, 'label-sikapandawa');
        new SpriteButton(this, 1220, 47, 'button-logout', () => this.logout());

        // Judul misi.
        const misi = addImageIfExists(this, 640, 118, 'label-misi');
        if (!misi) {
            this.add.text(640, 118, 'MISI PANDAWA', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '36px',
                fontStyle: 'bold',
                color: '#630995'
            }).setOrigin(0.5);
        }

        // Grid level 5x2.
        for (let level = 1; level <= TOTAL_LEVELS; level++) {
            const col = (level - 1) % 5;
            const row = level <= 5 ? 0 : 1;
            const unlocked = level <= progress.highestUnlockedLevel;
            const textureKey = unlocked ? `level-${level}-unlocked` : `level-${level}-locked`;
            new SpriteButton(this, GRID_XS[col], GRID_ROW_YS[row], textureKey, () => {
                if (this.modal.isOpen) return;
                if (unlocked) {
                    this.modal.show(`Gameplay Level ${level} akan dibuat pada progress berikutnya.`);
                } else {
                    this.modal.show('Selesaikan level sebelumnya terlebih dahulu.');
                }
            });
        }

        // Jejak Pandawa (terkunci pada MVP awal).
        new SpriteButton(this, 640, 575, 'jejak-locked', () => {
            if (this.modal.isOpen) return;
            this.modal.show('Jejak Pandawa terbuka setelah seluruh misi selesai.');
        });
    }

    private logout(): void {
        if (this.modal.isOpen) return;
        // Logout hanya menghapus akun aktif; akun dan progress tetap tersimpan.
        AuthStorageService.clearActiveAccount();
        this.cameras.main.fadeOut(200, 255, 244, 214);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('MainMenu');
        });
    }
}
