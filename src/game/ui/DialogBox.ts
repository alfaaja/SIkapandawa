import { Scene, GameObjects } from 'phaser';

import { SpeakerStyle } from '../types/gameplay';
import { makeText } from './fonts';

const DEPTH_DIALOG = 300;
const PANEL_X = 600;
const PANEL_Y = 610;
const PANEL_W = 700;
const PANEL_H = 141;
const TEXT_LEFT = PANEL_X - PANEL_W / 2 + 34;
const TEXT_TOP = PANEL_Y - PANEL_H / 2 + 22;
const TEXT_WRAP = 470;
const FALLBACK_RADIUS = 18;

/**
 * Kotak dialog screen-space memakai textbox per pembicara (potret baked
 * di sisi kanan texture). Lanjut dengan klik panel atau tombol aksi.
 */
export class DialogBox {
    private readonly scene: Scene;
    private readonly speakers: Record<string, SpeakerStyle>;
    private panel: GameObjects.Image | null = null;
    private fallbackPanel: GameObjects.Graphics | null = null;
    private clickZone: GameObjects.Rectangle | null = null;
    private speakerName: GameObjects.Text | null = null;
    private text: GameObjects.Text | null = null;
    private hint: GameObjects.Text | null = null;
    private lines: { speaker: string; text: string }[] = [];
    private index = 0;
    private onDone: (() => void) | null = null;

    constructor(scene: Scene, speakers: Record<string, SpeakerStyle>) {
        this.scene = scene;
        this.speakers = speakers;
    }

    get isOpen(): boolean {
        return this.panel !== null;
    }

    showLines(lines: { speaker: string; text: string }[], onDone: () => void): void {
        if (lines.length === 0) {
            onDone();
            return;
        }
        this.close();
        this.lines = lines;
        this.index = 0;
        this.onDone = onDone;
        this.renderCurrent();
    }

    /** Dipanggil tombol aksi / klik panel untuk lanjut ke baris berikutnya. */
    advance(): void {
        if (!this.isOpen) return;
        this.index += 1;
        if (this.index >= this.lines.length) {
            const done = this.onDone;
            this.close();
            if (done) done();
            return;
        }
        this.renderCurrent();
    }

    private renderCurrent(): void {
        const line = this.lines[this.index];
        const style = this.speakers[line.speaker];
        const texture = style ? style.textboxTexture : '';
        const hasTexture = this.scene.textures.exists(texture);

        if (!this.panel) {
            this.panel = this.scene.add.image(
                PANEL_X,
                PANEL_Y,
                hasTexture ? texture : '__WHITE'
            );
            this.panel.setDisplaySize(PANEL_W, PANEL_H)
                .setDepth(DEPTH_DIALOG);

            this.fallbackPanel = this.scene.add.graphics().setDepth(DEPTH_DIALOG);

            // Zona interaksi terpisah agar dialog fallback tetap bisa diklik
            // ketika image portrait disembunyikan.
            this.clickZone = this.scene.add.rectangle(
                PANEL_X,
                PANEL_Y,
                PANEL_W,
                PANEL_H,
                0xffffff,
                0.001
            ).setDepth(DEPTH_DIALOG + 2)
                .setInteractive({ useHandCursor: true });
            this.clickZone.on('pointerup', () => this.advance());

            this.speakerName = makeText(
                this.scene,
                TEXT_LEFT,
                TEXT_TOP - 14,
                style?.displayName ?? line.speaker,
                9,
                { color: '#630995' }
            ).setDepth(DEPTH_DIALOG + 1);

            this.text = makeText(this.scene, TEXT_LEFT, TEXT_TOP, '', 11, {
                wordWrapWidth: TEXT_WRAP,
                lineSpacing: 5
            }).setDepth(DEPTH_DIALOG + 1);

            this.hint = makeText(this.scene, PANEL_X + PANEL_W / 2 - 250, PANEL_Y + PANEL_H / 2 - 50, '>>', 11, {
                color: '#9441c0'
            }).setDepth(DEPTH_DIALOG + 1);
        }

        if (hasTexture) {
            this.panel.setTexture(texture).setDisplaySize(PANEL_W, PANEL_H).setVisible(true);
            this.fallbackPanel?.setVisible(false);
        } else {
            this.panel.setVisible(false);
            this.fallbackPanel
                ?.clear()
                .fillStyle(0xefc1ff, 1)
                .fillRoundedRect(
                    PANEL_X - PANEL_W / 2,
                    PANEL_Y - PANEL_H / 2,
                    PANEL_W,
                    PANEL_H,
                    FALLBACK_RADIUS
                )
                .lineStyle(5, 0x630995, 1)
                .strokeRoundedRect(
                    PANEL_X - PANEL_W / 2,
                    PANEL_Y - PANEL_H / 2,
                    PANEL_W,
                    PANEL_H,
                    FALLBACK_RADIUS
                )
                .setVisible(true);
        }
        this.speakerName
            ?.setText(style?.displayName ?? line.speaker)
            .setVisible(!hasTexture);
        this.text?.setPosition(TEXT_LEFT, hasTexture ? TEXT_TOP : TEXT_TOP + 12);
        this.text?.setText(line.text);
    }

    close(): void {
        this.panel?.destroy();
        this.fallbackPanel?.destroy();
        this.clickZone?.destroy();
        this.speakerName?.destroy();
        this.text?.destroy();
        this.hint?.destroy();
        this.panel = null;
        this.fallbackPanel = null;
        this.clickZone = null;
        this.speakerName = null;
        this.text = null;
        this.hint = null;
        this.lines = [];
        this.onDone = null;
    }
}
