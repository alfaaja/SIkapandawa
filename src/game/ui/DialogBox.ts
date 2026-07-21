import { Scene, GameObjects } from 'phaser';

import { SpeakerStyle } from '../types/gameplay';
import { makeText } from './fonts';

const DEPTH_DIALOG = 300;
const PANEL_X = 600;
const PANEL_Y = 640;
const PANEL_W = 700;
const PANEL_H = 141;
const TEXT_LEFT = PANEL_X - PANEL_W / 2 + 34;
const TEXT_TOP = PANEL_Y - PANEL_H / 2 + 22;
const TEXT_WRAP = 470;

/**
 * Kotak dialog screen-space memakai textbox per pembicara (potret baked
 * di sisi kanan texture). Lanjut dengan klik panel atau tombol aksi.
 */
export class DialogBox {
    private readonly scene: Scene;
    private readonly speakers: Record<string, SpeakerStyle>;
    private panel: GameObjects.Image | null = null;
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

        if (!this.panel) {
            if (this.scene.textures.exists(texture)) {
                this.panel = this.scene.add.image(PANEL_X, PANEL_Y, texture);
            } else {
                // Fallback panel polos bila texture hilang.
                this.panel = this.scene.add.image(PANEL_X, PANEL_Y, '__WHITE');
                this.panel.setTint(0xefc1ff);
            }
            this.panel.setDisplaySize(PANEL_W, PANEL_H)
                .setDepth(DEPTH_DIALOG)
                .setInteractive({ useHandCursor: true });
            this.panel.on('pointerup', () => this.advance());

            this.text = makeText(this.scene, TEXT_LEFT, TEXT_TOP, '', 11, {
                wordWrapWidth: TEXT_WRAP,
                lineSpacing: 5
            }).setDepth(DEPTH_DIALOG + 1);

            this.hint = makeText(this.scene, PANEL_X + PANEL_W / 2 - 190, PANEL_Y + PANEL_H / 2 - 22, '>>', 11, {
                color: '#9441c0'
            }).setDepth(DEPTH_DIALOG + 1);
        } else if (this.scene.textures.exists(texture)) {
            this.panel.setTexture(texture).setDisplaySize(PANEL_W, PANEL_H);
        }

        this.text?.setText(line.text);
    }

    close(): void {
        this.panel?.destroy();
        this.text?.destroy();
        this.hint?.destroy();
        this.panel = null;
        this.text = null;
        this.hint = null;
        this.lines = [];
        this.onDone = null;
    }
}
