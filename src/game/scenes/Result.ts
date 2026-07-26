import { Scene } from 'phaser';
import { applyLogicalCamera, DESIGN_WIDTH, DESIGN_HEIGHT } from '../ui/backdrop';
import { makeText } from '../ui/fonts';
import { SpriteButton } from '../ui/SpriteButton';
import { LEVELS } from '../data/levels';
import { AuthService } from '../services/AuthService';
import { ProgressService, PLAYABLE_LEVELS } from '../services/ProgressService';

export interface ResultData {
    levelId: number;
    runStars: number;
}

/**
 * Result — bintang run, best score, kesimpulan nilai, replay/next/back.
 * Progress sudah disimpan oleh Gameplay sebelum masuk ke scene ini.
 */
export class Result extends Scene {
    private levelId = 1;
    private runStars = 0;

    constructor() {
        super('Result');
    }

    init(data: ResultData): void {
        this.levelId = data.levelId ?? 1;
        this.runStars = Math.max(0, Math.min(3, data.runStars ?? 0));
    }

    create(): void {
        applyLogicalCamera(this);
        this.cameras.main.fadeIn(280, 20, 6, 40);

        const level = LEVELS[this.levelId];
        const prefix = level?.assetPrefix ?? 'lv1';
        const account = AuthService.getActiveAccount();
        const progress = account ? ProgressService.getProgress(account.id) : null;
        const bestStars = progress?.levelStars[this.levelId] ?? this.runStars;

        // Latar world diredupkan (sesuai preview result).
        if (this.textures.exists(`${prefix}-bg`)) {
            this.add.image(0, 0, `${prefix}-bg`).setOrigin(0, 0).setDisplaySize(1700, DESIGN_HEIGHT);
        }
        this.add.rectangle(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT, 0x1a0530, 0.66);

        // Tiga bintang hasil run ini.
        const starXs = [530, 640, 750];
        starXs.forEach((x, i) => {
            const key = i < this.runStars ? `${prefix}-bintang-hasil` : `${prefix}-bintang-hasil-abu`;
            if (this.textures.exists(key)) {
                this.add.image(x, 174, key).setDisplaySize(88, 82);
            }
        });

        // Panel kesimpulan.
        if (this.textures.exists(`${prefix}-teksboxt-kesimpulan`)) {
            this.add.image(640, 383, `${prefix}-teksboxt-kesimpulan`).setDisplaySize(830, 220);
        } else {
            this.add.rectangle(640, 383, 830, 220, 0x630995, 0.95);
        }
        makeText(this, 640, 314, level?.conclusionTitle ?? 'KESIMPULAN', 14, { color: '#000000' })
            .setOrigin(0.5);
        makeText(this, 640, 348, level?.conclusion ?? '', 10, {
            align: 'center',
            wordWrapWidth: 730,
            lineSpacing: 6,
            color: '#000000'
        }).setOrigin(0.5, 0);

        makeText(this, 640, 229, `Terbaik: ${bestStars}/3`, 10, { color: '#ffd24a' })
            .setOrigin(0.5);

        // Tombol: BACK, REPLAY (ikon), NEXT (level berikut atau Rapor Misi).
        new SpriteButton(this, 500, 596, `${prefix}-tombol-back`, () => this.goLevelSelect(), 147, 46);
        new SpriteButton(this, 640, 596, `${prefix}-tombol-replay`, () => this.replay(), 46, 46);

        const nextId = this.levelId + 1;
        const nextUnlocked = (progress?.highestUnlockedLevel ?? 1) >= nextId;
        const allMissionLevelsCompleted = this.levelId === 10
            && progress !== null
            && ProgressService.hasCompletedAllLevels(progress);
        if (allMissionLevelsCompleted) {
            new SpriteButton(
                this,
                780,
                596,
                `${prefix}-tombol-next`,
                () => this.goMissionReport(),
                147,
                46
            );
        } else if (nextId <= PLAYABLE_LEVELS && nextUnlocked) {
            new SpriteButton(this, 780, 596, `${prefix}-tombol-next`, () => this.goNext(nextId), 147, 46);
        }
    }

    private replay(): void {
        this.fadeTo(() => this.scene.start('Gameplay', { levelId: this.levelId }));
    }

    private goNext(nextId: number): void {
        const account = AuthService.getActiveAccount();
        const nextLevel = LEVELS[nextId];
        const introId = nextLevel?.introCharacterId;
        const needsIntro = account !== null
            && introId !== undefined
            && !ProgressService.hasSeenIntro(account.id, introId);
        this.fadeTo(() => {
            if (needsIntro && introId) {
                this.scene.start('IntroCharacter', { levelId: nextId, characterId: introId });
            } else {
                this.scene.start('Gameplay', { levelId: nextId });
            }
        });
    }

    private goLevelSelect(): void {
        this.fadeTo(() => this.scene.start('LevelSelect'));
    }

    private goMissionReport(): void {
        this.fadeTo(() => this.scene.start('MissionReport'));
    }

    private fadeTo(action: () => void): void {
        this.cameras.main.fadeOut(240, 20, 6, 40);
        this.cameras.main.once('camerafadeoutcomplete', action);
    }
}
