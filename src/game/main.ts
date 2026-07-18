import { CANVAS, Game, Scale } from 'phaser';
import { Boot } from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { MainMenu } from './scenes/MainMenu';
import { Register } from './scenes/Register';
import { Login } from './scenes/Login';
import { LevelSelect } from './scenes/LevelSelect';

//  Konfigurasi sesuai Game Bible: 1280x720, FIT + CENTER_BOTH, pixel-art.
//  Renderer CANVAS dipakai karena jalur WebGL (Phaser 4.0.0 dan 4.2.1) merender
//  texture canvas (objek Text) dengan latar hitam pada driver Mesa Intel HD 3000.
//  Verifikasi: canvas 2D Text benar (transparan + glyph), framebuffer WebGL salah.
const config: Phaser.Types.Core.GameConfig = {
    type: CANVAS,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#ffd46e',
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    dom: {
        createContainer: true
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        Register,
        Login,
        LevelSelect
    ]
};

const StartGame = (parent: string) => {

    const game = new Game({ ...config, parent });

    if (import.meta.env.DEV) {
        // Handle debug hanya untuk mode dev; tidak ikut build production.
        (window as unknown as Record<string, unknown>).__sikaGame = game;
    }

    return game;

}

export default StartGame;
