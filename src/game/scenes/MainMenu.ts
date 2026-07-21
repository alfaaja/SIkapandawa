import { Scene } from 'phaser';
import { addBackground, addImageIfExists, applyLogicalCamera } from '../ui/backdrop';
import { SpriteButton } from '../ui/SpriteButton';
import { makeText } from '../ui/fonts';

const PANEL_CENTER_X = 648;

/**
 * MainMenu — panel dengan logo besar dan tombol DAFTAR / MASUK.
 */
export class MainMenu extends Scene {
    constructor() {
        super('MainMenu');
    }

    create(): void {
        applyLogicalCamera(this);
        this.cameras.main.fadeIn(250, 255, 244, 214);
        addBackground(this, 'bg-panel-empty');

        // Logo tampil besar (312x385 logis) mengikuti preview; texture source-res.
        const logo = addImageIfExists(this, PANEL_CENTER_X, 260, 'logo-panel');
        if (logo) {
            logo.setDisplaySize(312, 385);
        } else {
            makeText(this, PANEL_CENTER_X, 240, 'SIKAPANDAWA', 32, { color: '#630995' })
                .setOrigin(0.5);
        }

        new SpriteButton(this, PANEL_CENTER_X - 90, 565, 'button-daftar', () => {
            this.goTo('Register');
        });
        new SpriteButton(this, PANEL_CENTER_X + 90, 565, 'button-masuk', () => {
            this.goTo('Login');
        });
    }

    private goTo(sceneKey: string): void {
        this.cameras.main.fadeOut(200, 255, 244, 214);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start(sceneKey);
        });
    }
}
