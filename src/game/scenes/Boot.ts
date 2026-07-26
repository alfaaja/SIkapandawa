import { Scene } from 'phaser';
import { ensureFontsLoaded } from '../ui/fonts';
import { ProgressSyncService } from '../services/ProgressSyncService';

/**
 * Boot — konfigurasi awal ringan: memuat background splash dan menunggu
 * font Press Start 2P siap sebelum Preloader membuat teks progress.
 */
export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    preload(): void {
        this.load.image('bg-splash', 'assets/frontend/splash/bg-splash.png');
    }

    create(): void {
        ProgressSyncService.initialize();
        ensureFontsLoaded().then(() => {
            this.scene.start('Preloader');
        });
    }
}
