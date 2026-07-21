import { Scene, GameObjects } from 'phaser';

import { ChoiceOption } from '../types/gameplay';
import { makeText } from './fonts';

const DEPTH_CHOICE = 320;
const PANEL_X = 640;
const PANEL_Y = 592;
const PANEL_W = 746;
const PANEL_H = 172;
/** Offset tengah tiap baris opsi dari atas panel (mengikuti texture pilihan). */
const ROW_OFFSETS = [64, 104, 144];
const ROW_W = 690;
const ROW_H = 36;

/**
 * Panel "Pilih Tindakanmu" (texture pilihan, judul baked) dengan tiga
 * baris opsi A/B/C yang dapat diklik/tap. Screen-space.
 */
export class ChoicePanel {
    private readonly scene: Scene;
    private readonly objects: GameObjects.GameObject[] = [];
    private open = false;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    get isOpen(): boolean {
        return this.open;
    }

    show(texturePrefix: string, choices: ChoiceOption[], onSelect: (id: 'A' | 'B' | 'C') => void): void {
        this.close();
        this.open = true;

        const key = `${texturePrefix}-pilihan`;
        if (this.scene.textures.exists(key)) {
            const panel = this.scene.add.image(PANEL_X, PANEL_Y, key)
                .setDisplaySize(PANEL_W, PANEL_H)
                .setDepth(DEPTH_CHOICE);
            this.objects.push(panel);
        } else {
            const fallback = this.scene.add.rectangle(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 0x630995, 0.95)
                .setDepth(DEPTH_CHOICE);
            this.objects.push(fallback);
        }

        const top = PANEL_Y - PANEL_H / 2;
        choices.forEach((choice, i) => {
            const rowY = top + ROW_OFFSETS[i];
            const zone = this.scene.add.rectangle(PANEL_X, rowY, ROW_W, ROW_H, 0xffffff, 0.001)
                .setDepth(DEPTH_CHOICE + 2)
                .setInteractive({ useHandCursor: true });
            const label = makeText(
                this.scene, PANEL_X - ROW_W / 2 + 14, rowY, `${choice.id}. ${choice.text}`, 9,
                { wordWrapWidth: ROW_W - 28, lineSpacing: 3 }
            ).setOrigin(0, 0.5).setDepth(DEPTH_CHOICE + 1);

            zone.on('pointerover', () => zone.setFillStyle(0x9441c0, 0.25));
            zone.on('pointerout', () => zone.setFillStyle(0xffffff, 0.001));
            zone.on('pointerup', () => {
                if (!this.open) return;
                this.close();
                onSelect(choice.id);
            });
            this.objects.push(zone, label);
        });
    }

    close(): void {
        this.open = false;
        for (const obj of this.objects) obj.destroy();
        this.objects.length = 0;
    }
}
