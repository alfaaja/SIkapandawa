import { Scene, GameObjects } from 'phaser';

import { DESIGN_WIDTH, DESIGN_HEIGHT } from './backdrop';
import { makeText } from './fonts';

const DEPTH_PAUSE = 800;

export interface PauseCallbacks {
    onResume: () => void;
    onReplay: () => void;
    onQuit: () => void;
    onToggleMute: () => void;
}

/**
 * Overlay pause screen-space: resume (play), replay, quit, mute/unmute.
 * Seluruh gameplay berhenti selama overlay tampil.
 */
export class PauseOverlay {
    private readonly scene: Scene;
    private readonly prefix: string;
    private readonly objects: GameObjects.GameObject[] = [];
    private muteButton: GameObjects.Image | null = null;
    private visible = false;

    constructor(scene: Scene, texturePrefix: string) {
        this.scene = scene;
        this.prefix = texturePrefix;
    }

    get isOpen(): boolean {
        return this.visible;
    }

    show(muted: boolean, callbacks: PauseCallbacks): void {
        if (this.visible) return;
        this.visible = true;

        const cx = DESIGN_WIDTH / 2;
        const cy = DESIGN_HEIGHT / 2;

        const dim = this.scene.add.rectangle(cx, cy, DESIGN_WIDTH, DESIGN_HEIGHT, 0x2a0640, 0.6)
            .setDepth(DEPTH_PAUSE).setInteractive();

        const panel = this.scene.add.graphics().setDepth(DEPTH_PAUSE + 1);
        const panelW = 460;
        const panelH = 260;
        panel.fillStyle(0x630995, 1);
        panel.fillRect(cx - panelW / 2 - 6, cy - panelH / 2 - 6, panelW + 12, panelH + 12);
        panel.fillStyle(0xefc1ff, 1);
        panel.fillRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH);

        const title = makeText(this.scene, cx, cy - 84, 'JEDA', 22, { color: '#630995' })
            .setOrigin(0.5).setDepth(DEPTH_PAUSE + 2);

        // Dim/panel/title masuk layer lebih dulu agar tombol berada di atasnya.
        this.objects.push(dim, panel, title);

        const makeButton = (
            x: number, texture: string, labelText: string, onClick: () => void
        ): GameObjects.Image => {
            const btn = this.scene.add.image(x, cy + 6, `${this.prefix}-${texture}`)
                .setDisplaySize(56, 56).setDepth(DEPTH_PAUSE + 2)
                .setInteractive({ useHandCursor: true });
            btn.on('pointerover', () => btn.setDisplaySize(62, 62));
            btn.on('pointerout', () => btn.setDisplaySize(56, 56));
            btn.on('pointerup', onClick);
            const label = makeText(this.scene, x, cy + 48, labelText, 8, { color: '#3a0a52' })
                .setOrigin(0.5).setDepth(DEPTH_PAUSE + 2);
            this.objects.push(btn, label);
            return btn;
        };

        makeButton(cx - 135, 'tombol-play-game', 'LANJUT', callbacks.onResume);
        makeButton(cx - 45, 'tombol-replay', 'ULANGI', callbacks.onReplay);
        this.muteButton = makeButton(cx + 45, muted ? 'tombol-mute' : 'tombol-unmute', 'SUARA', callbacks.onToggleMute);
        makeButton(cx + 135, 'tombol-quit', 'KELUAR', callbacks.onQuit);
    }

    setMuted(muted: boolean): void {
        if (this.muteButton) {
            this.muteButton.setTexture(`${this.prefix}-${muted ? 'tombol-mute' : 'tombol-unmute'}`);
            this.muteButton.setDisplaySize(56, 56);
        }
    }

    hide(): void {
        if (!this.visible) return;
        this.visible = false;
        for (const obj of this.objects) obj.destroy();
        this.objects.length = 0;
        this.muteButton = null;
    }
}
