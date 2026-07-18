import { Scene } from 'phaser';
import { addBackground, addImageIfExists } from '../ui/backdrop';
import { SpriteButton } from '../ui/SpriteButton';

const PANEL_CENTER_X = 648;

/**
 * MainMenu — panel dengan logo besar dan tombol DAFTAR / MASUK.
 */
export class MainMenu extends Scene {
    constructor() {
        super('MainMenu');
    }

    create(): void {
        this.cameras.main.fadeIn(250, 255, 244, 214);
        addBackground(this, 'bg-panel-empty');

        // Logo diperbesar 2x (integer scale, pixel art tetap tajam) mengikuti preview.
        const logo = addImageIfExists(this, PANEL_CENTER_X, 260, 'logo-panel');
        if (logo) {
            logo.setScale(2);
        } else {
            this.add.text(PANEL_CENTER_X, 240, 'SIKAPANDAWA', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '48px',
                fontStyle: 'bold',
                color: '#630995'
            }).setOrigin(0.5);
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
