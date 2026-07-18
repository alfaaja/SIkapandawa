import { Scene, GameObjects } from 'phaser';

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

        const { width, height } = this.scene.scale;
        const cx = width / 2;
        const cy = height / 2;

        const dim = this.scene.add.rectangle(cx, cy, width, height, 0x2a0640, 0.55)
            .setDepth(DEPTH_DIM)
            .setInteractive(); // menyerap klik di luar panel

        const panelW = 620;
        const panelH = 240;
        const panel = this.scene.add.graphics().setDepth(DEPTH_PANEL);
        panel.fillStyle(0x630995, 1);
        panel.fillRect(cx - panelW / 2 - 6, cy - panelH / 2 - 6, panelW + 12, panelH + 12);
        panel.fillStyle(0xffffff, 1);
        panel.fillRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH);

        const text = this.scene.add.text(cx, cy - 28, message, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#3a0a52',
            align: 'center',
            wordWrap: { width: panelW - 60 }
        }).setOrigin(0.5).setDepth(DEPTH_PANEL);

        const buttonW = 130;
        const buttonH = 48;
        const buttonY = cy + panelH / 2 - 46;
        const button = this.scene.add.rectangle(cx, buttonY, buttonW, buttonH, 0x9441c0)
            .setStrokeStyle(4, 0x630995)
            .setDepth(DEPTH_PANEL)
            .setInteractive({ useHandCursor: true });
        const buttonLabel = this.scene.add.text(cx, buttonY, 'OK', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(DEPTH_PANEL);

        button.on('pointerover', () => button.setFillStyle(0xa95fd2));
        button.on('pointerout', () => button.setFillStyle(0x9441c0));
        button.on('pointerup', () => this.hide());

        this.objects.push(dim, panel, text, button, buttonLabel);
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
