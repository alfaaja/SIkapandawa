import { Scene, GameObjects } from 'phaser';

import { makeText } from './fonts';

const DEPTH_HUD = 250;

export interface HudCallbacks {
    onPause: () => void;
    onQuit: () => void;
    onToggleMute: () => void;
    onReplay: () => void;
}

/**
 * HUD screen-space: plate level+nama pemain (kiri atas), bintang N/3,
 * box menu kanan atas (label sikapandawa + pause/quit/mute/replay).
 */
export class Hud {
    private readonly prefix: string;
    private readonly starText: GameObjects.Text;
    private muteButton: GameObjects.Image;
    private readonly objects: GameObjects.GameObject[] = [];

    constructor(
        scene: Scene,
        texturePrefix: string,
        levelId: number,
        playerName: string,
        muted: boolean,
        callbacks: HudCallbacks
    ) {
        this.prefix = texturePrefix;

        // Plate level + nama (kiri atas). Kotak angka menempati sisi kiri texture.
        const plate = scene.add.image(24 + 115, 24 + 27, `${texturePrefix}-level-nama`)
            .setDisplaySize(230, 54).setDepth(DEPTH_HUD);
        const levelNumber = makeText(scene, 24 + 26, 24 + 26, String(levelId), 18, { color: '#3a0a52' })
            .setOrigin(0.5).setDepth(DEPTH_HUD + 1);
        const name = makeText(scene, 24 + 66, 24 + 26, this.fitName(playerName), 11, { color: '#3a0a52' })
            .setOrigin(0, 0.5).setDepth(DEPTH_HUD + 1);

        // Bintang kebaikan + counter.
        const star = scene.add.image(42, 100, `${texturePrefix}-bintang-kebaikan`)
            .setDisplaySize(34, 32).setDepth(DEPTH_HUD);
        this.starText = makeText(scene, 66, 100, '0/3', 13, { color: '#3a0a52' })
            .setOrigin(0, 0.5).setDepth(DEPTH_HUD + 1);

        // Box menu kanan atas.
        const box = scene.add.image(1066, 51, `${texturePrefix}-box-menu`)
            .setDisplaySize(384, 56).setDepth(DEPTH_HUD);
        const label = scene.add.image(968, 51, `${texturePrefix}-label-sikapandawa`)
            .setDisplaySize(172, 40).setDepth(DEPTH_HUD + 1);

        // Elemen dasar masuk layer lebih dulu; tombol menyusul agar di atas box.
        this.objects.push(plate, levelNumber, name, star, this.starText, box, label);

        const makeButton = (x: number, texture: string, onClick: () => void): GameObjects.Image => {
            const btn = scene.add.image(x, 51, `${texturePrefix}-${texture}`)
                .setDisplaySize(36, 36).setDepth(DEPTH_HUD + 1)
                .setInteractive({ useHandCursor: true });
            btn.on('pointerover', () => btn.setDisplaySize(40, 40));
            btn.on('pointerout', () => btn.setDisplaySize(36, 36));
            btn.on('pointerup', onClick);
            this.objects.push(btn);
            return btn;
        };

        makeButton(1090, 'tombol-pause-game', callbacks.onPause);
        makeButton(1134, 'tombol-quit', callbacks.onQuit);
        this.muteButton = makeButton(1178, muted ? 'tombol-mute' : 'tombol-unmute', callbacks.onToggleMute);
        makeButton(1222, 'tombol-replay', callbacks.onReplay);
    }

    private fitName(name: string): string {
        return name.length > 12 ? `${name.slice(0, 11)}…` : name;
    }

    setStars(earned: number): void {
        this.starText.setText(`${earned}/3`);
    }

    setMuted(muted: boolean): void {
        this.muteButton.setTexture(`${this.prefix}-${muted ? 'tombol-mute' : 'tombol-unmute'}`);
        this.muteButton.setDisplaySize(36, 36);
    }
}
