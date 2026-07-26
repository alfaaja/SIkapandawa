import { Scene } from 'phaser';
import { getMissionRank } from '../data/missionReport';
import { AuthService } from '../services/AuthService';
import { ProgressService } from '../services/ProgressService';
import { BackgroundMusicService } from '../services/BackgroundMusicService';
import { applyLogicalCamera, DESIGN_HEIGHT, DESIGN_WIDTH } from '../ui/backdrop';
import { makeText } from '../ui/fonts';
import { SpriteButton } from '../ui/SpriteButton';

const FADE_MS = 240;

/**
 * MissionReport — rangkuman best stars Level 1–10 dan gerbang unlock Jejak.
 * Scene selalu membaca progress aktif agar aman dibuka ulang atau di-refresh.
 */
export class MissionReport extends Scene {
    constructor() {
        super('MissionReport');
    }

    create(): void {
        const account = AuthService.getActiveAccount();
        if (!account) {
            this.scene.start('MainMenu');
            return;
        }

        applyLogicalCamera(this);
        BackgroundMusicService.ensurePlaying(this);
        let progress = ProgressService.getProgress(account.id);
        if (!ProgressService.hasCompletedAllLevels(progress)) {
            this.scene.start('LevelSelect');
            return;
        }
        if (!ProgressService.unlockJejakPandawa(account.id)) {
            this.scene.start('LevelSelect');
            return;
        }
        progress = ProgressService.getProgress(account.id);

        const totalStars = Math.max(0, Math.min(30, ProgressService.totalStars(progress)));
        const rank = getMissionRank(totalStars);

        this.cameras.main.fadeIn(FADE_MS, 20, 6, 40);
        this.drawBackground();

        if (this.textures.exists('mission-report-star')) {
            this.add.image(496, 262, 'mission-report-star').setDisplaySize(76, 72);
        } else {
            this.drawFallbackStar(496, 262);
        }
        makeText(this, 666, 262, `${totalStars}/30`, 40, {
            color: '#ffffff'
        }).setOrigin(0.5).setStroke('#000000', 8);

        if (this.textures.exists('mission-report-message-panel')) {
            this.add.image(640, 398, 'mission-report-message-panel').setDisplaySize(698, 156);
        } else {
            const panel = this.add.graphics();
            panel.fillStyle(0x630995, 1);
            panel.fillRoundedRect(285, 316, 710, 164, 20);
            panel.fillStyle(0xe8b8ff, 1);
            panel.fillRoundedRect(291, 322, 698, 152, 16);
        }

        makeText(this, 640, 354, rank.name, 20, {
            color: '#000000',
            align: 'center'
        }).setOrigin(0.5);
        makeText(this, 640, 402, rank.message, 12, {
            color: '#000000',
            align: 'center',
            wordWrapWidth: 610,
            lineSpacing: 6
        }).setOrigin(0.5, 0);

        const backTexture = this.textures.exists('mission-report-button-back')
            ? 'mission-report-button-back'
            : 'lv10-tombol-back';
        new SpriteButton(this, 640, 507, backTexture, () => this.goBack(), 94, 30);
    }

    private drawBackground(): void {
        if (this.textures.exists('mission-report-background')) {
            this.add.image(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, 'mission-report-background');
            return;
        }

        const background = this.add.graphics();
        background.fillStyle(0x1b0c27, 1);
        background.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
        background.fillStyle(0x3b1a31, 1);
        background.fillRect(0, 260, DESIGN_WIDTH, 460);
        background.fillStyle(0x522536, 1);
        background.fillRect(0, 440, DESIGN_WIDTH, 280);

        background.fillStyle(0x2b1128, 0.86);
        background.fillRect(0, 560, DESIGN_WIDTH, 160);
        background.fillStyle(0x6f392c, 0.8);
        background.fillRect(0, 560, DESIGN_WIDTH, 8);

        // Siluet candi pixel-art sederhana dari Graphics, bukan preview interaktif.
        for (const side of [0, 1]) {
            const direction = side === 0 ? 1 : -1;
            const baseX = side === 0 ? 0 : DESIGN_WIDTH;
            background.fillStyle(0x351423, 0.92);
            background.fillRect(baseX, 210, direction * 120, 350);
            background.fillRect(baseX, 300, direction * 185, 260);
            background.fillRect(baseX, 390, direction * 250, 170);
            background.fillStyle(0x7b3f31, 0.72);
            background.fillRect(baseX, 268, direction * 150, 14);
            background.fillRect(baseX, 358, direction * 215, 14);
        }
    }

    private drawFallbackStar(x: number, y: number): void {
        const points: Array<{ x: number; y: number }> = [];
        const outerRadius = 38;
        const innerRadius = 17;
        for (let index = 0; index < 10; index++) {
            const radius = index % 2 === 0 ? outerRadius : innerRadius;
            const angle = -Math.PI / 2 + index * Math.PI / 5;
            points.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        }
        this.add.polygon(x, y, points, 0xffd524)
            .setStrokeStyle(5, 0xf08a00);
    }

    private goBack(): void {
        this.fadeToLevelSelect();
    }

    private fadeToLevelSelect(): void {
        this.cameras.main.fadeOut(FADE_MS, 20, 6, 40);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('LevelSelect');
        });
    }
}
