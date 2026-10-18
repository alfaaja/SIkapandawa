import { Scene } from 'phaser';
import { addBackground, addImageIfExists, applyLogicalCamera } from '../ui/backdrop';
import { SpriteButton } from '../ui/SpriteButton';
import { makeText } from '../ui/fonts';
import { AuthService } from '../services/AuthService';
import { ProgressService } from '../services/ProgressService';
import { BackgroundMusicService } from '../services/BackgroundMusicService';
import { addMonitoringButton } from '../ui/MonitoringButton';

const PANEL_CENTER_X = 648;

/**
 * MainMenu — panel dengan logo besar dan tombol DAFTAR / MASUK / MONITORING.
 */
export class MainMenu extends Scene {
    constructor() {
        super('MainMenu');
    }

    create(): void {
        BackgroundMusicService.stop(this);
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

        new SpriteButton(this, PANEL_CENTER_X - 90, 535, 'button-daftar', () => {
            this.goTo('Register');
        }).image.setName('main-menu-register');
        new SpriteButton(this, PANEL_CENTER_X + 90, 535, 'button-masuk', () => {
            this.goTo('Login');
        }).image.setName('main-menu-login');
        addMonitoringButton(this, PANEL_CENTER_X, 610, 'main-menu-monitoring');

        void AuthService.restoreSession().then(async (account) => {
            if (!account || !this.scene.isActive()) return;
            await ProgressService.hydrate(account.id);
            if (this.scene.isActive()) this.goTo('LevelSelect');
        });
    }

    private goTo(sceneKey: string): void {
        this.cameras.main.fadeOut(200, 255, 244, 214);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start(sceneKey);
        });
    }
}
