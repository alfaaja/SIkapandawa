import { Scene } from 'phaser';
import { addBackground, addImageIfExists, applyLogicalCamera } from '../ui/backdrop';
import { SpriteButton } from '../ui/SpriteButton';
import { MessageModal } from '../ui/MessageModal';
import { makeText } from '../ui/fonts';
import { AuthStorageService } from '../services/AuthStorageService';
import {
    ProgressStorageService, TOTAL_LEVELS, PLAYABLE_LEVELS
} from '../services/ProgressStorageService';
import { LEVELS } from '../data/levels';

const GRID_XS = [380, 510, 640, 770, 900];
const GRID_ROW_YS = [240, 350];

/**
 * LevelSelect — panel user, total bintang, grid 10 level, Jejak Pandawa, logout.
 * Level 1–4 membuka Gameplay (Level 1 dan 3 lewat Intro pada first entry);
 * Level 5+ placeholder untuk progress berikutnya.
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

        applyLogicalCamera(this);
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
        const displayName = account.displayName.length > 16
            ? `${account.displayName.slice(0, 15)}…`
            : account.displayName;
        makeText(this, 151, 45, displayName, 13).setOrigin(0.5);
        makeText(this, 367, 45, String(totalStars), 15, { color: '#ffffff' }).setOrigin(0.5);

        // Branding kanan atas + logout.
        addImageIfExists(this, 1090, 46, 'label-sikapandawa');
        new SpriteButton(this, 1220, 47, 'button-logout', () => this.logout());

        // Judul misi.
        const misi = addImageIfExists(this, 640, 118, 'label-misi');
        if (!misi) {
            makeText(this, 640, 118, 'MISI PANDAWA', 24, { color: '#630995' }).setOrigin(0.5);
        }

        // Grid level 5x2.
        for (let level = 1; level <= TOTAL_LEVELS; level++) {
            const col = (level - 1) % 5;
            const row = level <= 5 ? 0 : 1;
            const unlocked = level <= progress.highestUnlockedLevel;
            const textureKey = unlocked ? `level-${level}-unlocked` : `level-${level}-locked`;
            new SpriteButton(this, GRID_XS[col], GRID_ROW_YS[row], textureKey, () => {
                this.onLevelClick(level, unlocked, account.id);
            });
        }

        // Jejak Pandawa (terkunci pada MVP awal).
        new SpriteButton(this, 640, 575, 'jejak-locked', () => {
            if (this.modal.isOpen) return;
            this.modal.show('Jejak Pandawa terbuka setelah seluruh misi selesai.');
        });
    }

    private onLevelClick(level: number, unlocked: boolean, accountId: string): void {
        if (this.modal.isOpen) return;

        if (!unlocked) {
            this.modal.show('Selesaikan level sebelumnya terlebih dahulu.');
            return;
        }
        if (level > PLAYABLE_LEVELS) {
            this.modal.show(`Gameplay Level ${level} akan dibuat pada progress berikutnya.`);
            return;
        }

        const definition = LEVELS[level];
        const introId = definition?.introCharacterId;
        const needIntro = introId !== undefined
            && !ProgressStorageService.hasSeenIntro(accountId, introId);

        this.cameras.main.fadeOut(220, 255, 244, 214);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            if (needIntro && introId) {
                this.scene.start('IntroCharacter', { levelId: level, characterId: introId });
            } else {
                this.scene.start('Gameplay', { levelId: level });
            }
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
