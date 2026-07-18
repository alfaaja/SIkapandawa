import { Scene, GameObjects } from 'phaser';

/**
 * Tombol berbasis sprite dengan state hover/pressed/disabled
 * dan pengaman double-click.
 */
export class SpriteButton {
    readonly image: GameObjects.Image;
    private readonly baseScaleX: number;
    private readonly baseScaleY: number;
    private enabled = true;
    private clickLocked = false;

    constructor(
        scene: Scene,
        x: number,
        y: number,
        textureKey: string,
        onClick: () => void,
        displayWidth?: number,
        displayHeight?: number
    ) {
        this.image = scene.add.image(x, y, textureKey);
        if (displayWidth !== undefined && displayHeight !== undefined) {
            this.image.setDisplaySize(displayWidth, displayHeight);
        }
        this.baseScaleX = this.image.scaleX;
        this.baseScaleY = this.image.scaleY;
        this.image.setInteractive({ useHandCursor: true });

        this.image.on('pointerover', () => {
            if (this.enabled) this.image.setTint(0xffe9a8);
        });
        this.image.on('pointerout', () => {
            this.image.clearTint();
            this.image.setScale(this.baseScaleX, this.baseScaleY);
        });
        this.image.on('pointerdown', () => {
            if (this.enabled) this.image.setScale(this.baseScaleX * 0.96, this.baseScaleY * 0.96);
        });
        this.image.on('pointerup', () => {
            this.image.setScale(this.baseScaleX, this.baseScaleY);
            if (!this.enabled || this.clickLocked) return;
            this.clickLocked = true;
            // Kunci sesaat agar satu klik tidak memicu aksi ganda.
            scene.time.delayedCall(350, () => {
                this.clickLocked = false;
            });
            onClick();
        });
    }

    setEnabled(enabled: boolean): this {
        this.enabled = enabled;
        this.image.setAlpha(enabled ? 1 : 0.55);
        if (enabled) {
            this.image.setInteractive({ useHandCursor: true });
        } else {
            this.image.disableInteractive();
        }
        return this;
    }

    setDepth(depth: number): this {
        this.image.setDepth(depth);
        return this;
    }
}
