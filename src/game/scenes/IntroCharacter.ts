import { Scene } from 'phaser';
import { applyLogicalCamera, DESIGN_WIDTH, DESIGN_HEIGHT } from '../ui/backdrop';
import { makeText } from '../ui/fonts';
import { SpriteButton } from '../ui/SpriteButton';
import { CHARACTER_INTROS } from '../data/characters';
import { LEVELS } from '../data/levels';
import { AuthStorageService } from '../services/AuthStorageService';
import { ProgressStorageService } from '../services/ProgressStorageService';

export interface IntroCharacterData {
    levelId: number;
    characterId: string;
}

/**
 * IntroCharacter — scene generik perkenalan Pandawa (first entry level ganjil).
 * PLAY menandai introSeen lalu masuk Gameplay; BACK kembali ke Level Select.
 */
export class IntroCharacter extends Scene {
    private levelId = 1;
    private characterId = 'yudhistira';

    constructor() {
        super('IntroCharacter');
    }

    init(data: IntroCharacterData): void {
        this.levelId = data.levelId ?? 1;
        this.characterId = data.characterId ?? 'yudhistira';
    }

    create(): void {
        applyLogicalCamera(this);
        this.cameras.main.fadeIn(250, 20, 6, 40);

        const intro = CHARACTER_INTROS[this.characterId];
        const level = LEVELS[this.levelId];

        // Latar: world level (bagian kiri) diredupkan, sesuai preview perkenalan.
        const bgKey = `${level?.assetPrefix ?? 'lv1'}-bg`;
        if (this.textures.exists(bgKey)) {
            const bg = this.add.image(0, 0, bgKey).setOrigin(0, 0);
            bg.setDisplaySize(1700, DESIGN_HEIGHT);
        }
        this.add.rectangle(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT, 0x1a0530, 0.62);

        // Panel perkenalan (bust menempati ±35% atas texture; teks tidak baked).
        // Texture 1976x890 → tampil 660x297; kotak panel berada di bawah bust.
        if (intro && this.textures.exists(intro.panelTexture)) {
            const panel = this.add.image(640, 392, intro.panelTexture);
            panel.setDisplaySize(660, 297);
        }

        makeText(this, 640, 348, intro?.name ?? 'PANDAWA', 15, { color: '#630995' })
            .setOrigin(0.5);
        makeText(this, 640, 448, intro?.introText ?? '', 8, {
            align: 'center',
            wordWrapWidth: 540,
            lineSpacing: 6,
            color: '#3a0a52'
        }).setOrigin(0.5);

        const prefix = level?.assetPrefix ?? 'lv1';
        new SpriteButton(this, 548, 592, `${prefix}-tombol-back`, () => this.goBack(), 147, 46);
        new SpriteButton(this, 732, 592, `${prefix}-tombol-play`, () => this.play(), 147, 46);
    }

    private play(): void {
        const account = AuthStorageService.getActiveAccount();
        if (account) {
            ProgressStorageService.markIntroSeen(account.id, this.characterId);
        }
        this.cameras.main.fadeOut(220, 20, 6, 40);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('Gameplay', { levelId: this.levelId });
        });
    }

    private goBack(): void {
        this.cameras.main.fadeOut(220, 20, 6, 40);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('LevelSelect');
        });
    }
}
