import { Scene, GameObjects } from 'phaser';


export interface MovementInputState {
    left: boolean;
    right: boolean;
    actionJustPressed: boolean;
}

const DEPTH_UI = 200;

/**
 * Tombol touch kiri/kanan/aksi (screen-space). Keyboard dan touch menulis
 * ke MovementInputState yang sama di Gameplay.
 */
export class TouchControls {
    private readonly leftButton: GameObjects.Image;
    private readonly rightButton: GameObjects.Image;
    private readonly actionButton: GameObjects.Image;
    private actionEnabled = false;

    leftDown = false;
    rightDown = false;
    private actionPressed = false;

    constructor(scene: Scene, texturePrefix: string) {
        this.leftButton = scene.add.image(78, 650, `${texturePrefix}-tombol-kiri`)
            .setDisplaySize(62, 62).setDepth(DEPTH_UI)
            .setInteractive({ useHandCursor: true });
        this.rightButton = scene.add.image(150, 650, `${texturePrefix}-tombol-kanan`)
            .setDisplaySize(62, 62).setDepth(DEPTH_UI)
            .setInteractive({ useHandCursor: true });
        this.actionButton = scene.add.image(1186, 648, `${texturePrefix}-tombol-aksi`)
            .setDisplaySize(76, 76).setDepth(DEPTH_UI)
            .setInteractive({ useHandCursor: true });


        this.bindHold(this.leftButton, (down) => { this.leftDown = down; });
        this.bindHold(this.rightButton, (down) => { this.rightDown = down; });
        this.actionButton.on('pointerdown', () => {
            if (this.actionEnabled) {
                this.actionPressed = true;
                this.actionButton.setScale(this.actionButton.scaleX * 0.94);
            }
        });
        this.actionButton.on('pointerup', () => this.actionButton.setDisplaySize(76, 76));
        this.actionButton.on('pointerout', () => this.actionButton.setDisplaySize(76, 76));

        this.setActionEnabled(false);
    }

    private bindHold(button: GameObjects.Image, set: (down: boolean) => void): void {
        button.on('pointerdown', () => { set(true); button.setAlpha(0.8); });
        button.on('pointerup', () => { set(false); button.setAlpha(1); });
        button.on('pointerout', () => { set(false); button.setAlpha(1); });
    }

    /** Tombol aksi redup saat tidak ada target interaksi di dekat pemain. */
    setActionEnabled(enabled: boolean): void {
        this.actionEnabled = enabled;
        this.actionButton.setAlpha(enabled ? 1 : 0.45);
    }

    /** Ambil dan reset flag action (edge-triggered). */
    consumeAction(): boolean {
        const pressed = this.actionPressed;
        this.actionPressed = false;
        return pressed;
    }

    resetHold(): void {
        this.leftDown = false;
        this.rightDown = false;
        this.actionPressed = false;
    }

    setVisible(visible: boolean): void {
        this.leftButton.setVisible(visible);
        this.rightButton.setVisible(visible);
        this.actionButton.setVisible(visible);
    }
}
