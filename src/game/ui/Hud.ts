import { Scene, GameObjects } from 'phaser';

import { makeText } from './fonts';

const DEPTH_HUD = 250;
const PLATE_X = 139;
const PLATE_Y = 51;
const PLATE_W = 230;
const PLATE_H = 54;
const LEVEL_NUMBER_X = 50;
const PLAYER_NAME_X = 165;
const MENU_Y = 51;
const MENU_BOX_X = 1070;
const MENU_BOX_W = 380;
const MENU_LABEL_X = 976;
const MENU_BUTTON_SIZE = 38;
const MENU_BUTTON_HOVER_SIZE = 42;
const MENU_BUTTON_XS = [1092, 1138, 1184, 1230] as const;

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
        const plate = scene.add.image(PLATE_X, PLATE_Y, `${texturePrefix}-level-nama`)
            .setDisplaySize(PLATE_W, PLATE_H).setDepth(DEPTH_HUD);
        const levelNumber = makeText(scene, LEVEL_NUMBER_X, PLATE_Y, String(levelId), 18, { color: '#3a0a52' })
            .setOrigin(0.5).setDepth(DEPTH_HUD + 1);
        const name = makeText(scene, PLAYER_NAME_X, PLATE_Y, this.fitName(playerName), 11, { color: '#3a0a52' })
            .setOrigin(0.5).setDepth(DEPTH_HUD + 1);

        // Bintang kebaikan + counter.
        const star = scene.add.image(42, 100, `${texturePrefix}-bintang-kebaikan`)
            .setDisplaySize(34, 32).setDepth(DEPTH_HUD);
        this.starText = makeText(scene, 66, 100, '0/3', 13, { color: '#3a0a52' })
            .setOrigin(0, 0.5).setDepth(DEPTH_HUD + 1);

        // Box menu kanan atas.
        const box = scene.add.image(MENU_BOX_X, MENU_Y, `${texturePrefix}-box-menu`)
            .setDisplaySize(MENU_BOX_W, 56).setDepth(DEPTH_HUD);
        const label = scene.add.image(MENU_LABEL_X, MENU_Y, `${texturePrefix}-label-sikapandawa`)
            .setDisplaySize(150, 35).setDepth(DEPTH_HUD + 1);

        // Elemen dasar masuk layer lebih dulu; tombol menyusul agar di atas box.
        this.objects.push(plate, levelNumber, name, star, this.starText, box, label);

        const makeButton = (x: number, texture: string, onClick: () => void): GameObjects.Image => {
            const btn = scene.add.image(x, MENU_Y, `${texturePrefix}-${texture}`)
                .setDisplaySize(MENU_BUTTON_SIZE, MENU_BUTTON_SIZE).setDepth(DEPTH_HUD + 1)
                .setInteractive({ useHandCursor: true });
            btn.on('pointerover', () => btn.setDisplaySize(MENU_BUTTON_HOVER_SIZE, MENU_BUTTON_HOVER_SIZE));
            btn.on('pointerout', () => btn.setDisplaySize(MENU_BUTTON_SIZE, MENU_BUTTON_SIZE));
            btn.on('pointerup', onClick);
            this.objects.push(btn);
            return btn;
        };

        makeButton(MENU_BUTTON_XS[0], 'tombol-pause-game', callbacks.onPause);
        makeButton(MENU_BUTTON_XS[1], 'tombol-quit', callbacks.onQuit);
        this.muteButton = makeButton(
            MENU_BUTTON_XS[2],
            muted ? 'tombol-mute' : 'tombol-unmute',
            callbacks.onToggleMute
        );
        makeButton(MENU_BUTTON_XS[3], 'tombol-replay', callbacks.onReplay);
    }

    private fitName(name: string): string {
        return name.length > 12 ? `${name.slice(0, 11)}…` : name;
    }

    setStars(earned: number): void {
        this.starText.setText(`${earned}/3`);
    }

    setMuted(muted: boolean): void {
        this.muteButton.setTexture(`${this.prefix}-${muted ? 'tombol-mute' : 'tombol-unmute'}`);
        this.muteButton.setDisplaySize(MENU_BUTTON_SIZE, MENU_BUTTON_SIZE);
    }
}
