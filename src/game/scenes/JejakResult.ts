import { Scene } from 'phaser';
import { getJejakResultTier } from '../data/jejakPandawa';
import { AuthStorageService } from '../services/AuthStorageService';
import { ProgressStorageService } from '../services/ProgressStorageService';
import { addBackground, applyLogicalCamera, DESIGN_HEIGHT, DESIGN_WIDTH } from '../ui/backdrop';
import { makeText } from '../ui/fonts';
import { SpriteButton } from '../ui/SpriteButton';

export interface JejakResultData {
    score: number;
}

export class JejakResult extends Scene {
    private score = 0;

    constructor() {
        super('JejakResult');
    }

    init(data: JejakResultData): void {
        this.score = Math.max(0, Math.min(10, Math.floor(data.score ?? 0)));
    }

    create(): void {
        const account = AuthStorageService.getActiveAccount();
        if (!account) {
            this.scene.start('MainMenu');
            return;
        }
        const progress = ProgressStorageService.getProgress(account.id);
        if (!progress.jejakPandawaUnlocked) {
            this.scene.start('LevelSelect');
            return;
        }

        applyLogicalCamera(this);
        addBackground(this, 'jejak-background');
        this.add.rectangle(
            DESIGN_WIDTH / 2,
            DESIGN_HEIGHT / 2,
            DESIGN_WIDTH,
            DESIGN_HEIGHT,
            0x16200b,
            0.68
        );
        this.cameras.main.fadeIn(220, 20, 30, 10);

        const tier = getJejakResultTier(this.score);
        makeText(this, 640, 102, 'RAPOR JEJAK PANDAWA', 22, {
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        makeText(this, 640, 205, `${this.score}/10`, 42, {
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5).setStroke('#000000', 8);
        if (this.textures.exists('jejak-message-panel')) {
            this.add.image(640, 385, 'jejak-message-panel').setDisplaySize(820, 183);
        } else {
            this.add.rectangle(640, 385, 820, 183, 0xe9b8ff)
                .setStrokeStyle(5, 0x630995);
        }
        makeText(this, 640, 335, tier.title, 20, {
            color: '#000000',
            align: 'center'
        }).setOrigin(0.5);
        makeText(this, 640, 382, tier.message, 11, {
            color: '#000000',
            align: 'center',
            wordWrapWidth: 700,
            lineSpacing: 7
        }).setOrigin(0.5, 0);

        new SpriteButton(
            this, 560, 535, 'jejak-button-back', () => this.goLevelSelect(), 94, 30
        );
        new SpriteButton(
            this, 710, 535, 'jejak-button-replay', () => this.replay(), 50, 50
        );
        makeText(this, 710, 574, 'ULANGI', 8, { color: '#ffffff' }).setOrigin(0.5);
    }

    private goLevelSelect(): void {
        this.fadeTo(() => this.scene.start('LevelSelect'));
    }

    private replay(): void {
        this.fadeTo(() => this.scene.start('JejakPandawa'));
    }

    private fadeTo(action: () => void): void {
        this.cameras.main.fadeOut(220, 20, 30, 10);
        this.cameras.main.once('camerafadeoutcomplete', action);
    }
}
