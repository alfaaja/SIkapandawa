import { CANVAS, Game, Scale } from 'phaser';
import { Boot } from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { MainMenu } from './scenes/MainMenu';
import { Register } from './scenes/Register';
import { Login } from './scenes/Login';
import { LevelSelect } from './scenes/LevelSelect';
import { IntroCharacter } from './scenes/IntroCharacter';
import { Gameplay } from './scenes/Gameplay';
import { Result } from './scenes/Result';

//  Baseline HD (disetujui pengguna): backing 2560x1440 dengan kamera zoom 2.
//  Seluruh layout tetap memakai koordinat logis 1280x720 (Game Bible);
//  tekstur @2x ter-render 1:1 sehingga tajam pada layar besar.
//  Renderer CANVAS dipertahankan karena jalur WebGL (Phaser 4.0.0/4.2.1)
//  merender texture canvas (objek Text) berlatar hitam pada GPU mesin dev
//  (Mesa Intel HD 3000). Lihat docs/RENDERING_QUALITY_AUDIT.md.
const config: Phaser.Types.Core.GameConfig = {
    type: CANVAS,
    width: 2560,
    height: 1440,
    parent: 'game-container',
    backgroundColor: '#ffd46e',
    antialias: true,
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
        LevelSelect,
        IntroCharacter,
        Gameplay,
        Result
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
