import { Scene } from 'phaser';

/**
 * Boot — konfigurasi awal ringan. Hanya memuat background splash
 * agar Preloader bisa langsung menampilkannya.
 */
export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    preload(): void {
        this.load.image('bg-splash', 'assets/frontend/splash/bg-splash.png');
    }

    create(): void {
        this.scene.start('Preloader');
    }
}
