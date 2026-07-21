import { Scene, GameObjects } from 'phaser';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from './backdrop';
import { makeText } from './fonts';

const DEPTH_DIM = 900;
const DEPTH_PANEL = 901;

/**
 * Modal pesan tunggal per scene. Memblokir input di belakangnya
 * dan hanya satu modal yang tampil pada satu waktu.
 */
export class MessageModal {
    private readonly scene: Scene;
    private readonly objects: GameObjects.GameObject[] = [];
    private visible = false;
    private onClose?: () => void;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    get isOpen(): boolean {
        return this.visible;
    }

    show(message: string, onClose?: () => void): void {
        if (this.visible) return;
        this.visible = true;
        this.onClose = onClose;

        const cx = DESIGN_WIDTH / 2;
        const cy = DESIGN_HEIGHT / 2;

        const dim = this.scene.add.rectangle(cx, cy, DESIGN_WIDTH, DESIGN_HEIGHT, 0x2a0640, 0.55)
            .setDepth(DEPTH_DIM)
            .setInteractive(); // menyerap klik di luar panel

        const panelW = 640;
        const panelH = 250;
        const panel = this.scene.add.graphics().setDepth(DEPTH_PANEL);
        panel.fillStyle(0x630995, 1);
        panel.fillRect(cx - panelW / 2 - 6, cy - panelH / 2 - 6, panelW + 12, panelH + 12);
        panel.fillStyle(0xffffff, 1);
        panel.fillRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH);

        const text = makeText(this.scene, cx, cy - 30, message, 13, {
            align: 'center',
            wordWrapWidth: panelW - 60,
            lineSpacing: 6
        }).setOrigin(0.5).setDepth(DEPTH_PANEL);
        this.objects.push(text);

        const buttonW = 130;
        const buttonH = 46;
        const buttonY = cy + panelH / 2 - 44;
        const button = this.scene.add.rectangle(cx, buttonY, buttonW, buttonH, 0x9441c0)
            .setStrokeStyle(4, 0x630995)
            .setDepth(DEPTH_PANEL)
            .setInteractive({ useHandCursor: true });
        const buttonLabel = makeText(this.scene, cx, buttonY, 'OK', 16, { color: '#ffffff' })
            .setOrigin(0.5).setDepth(DEPTH_PANEL);

        button.on('pointerover', () => button.setFillStyle(0xa95fd2));
        button.on('pointerout', () => button.setFillStyle(0x9441c0));
        button.on('pointerup', () => this.hide());

        this.objects.push(dim, panel, button, buttonLabel);
    }

    hide(): void {
        if (!this.visible) return;
        this.visible = false;
        for (const obj of this.objects) {
            obj.destroy();
        }
        this.objects.length = 0;
        const callback = this.onClose;
        this.onClose = undefined;
        if (callback) callback();
    }
}
