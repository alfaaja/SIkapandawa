import { Scene, GameObjects } from 'phaser';

/**
 * Press Start 2P dimuat lokal via @font-face (public/style.css).
 * Teks dibuat SETELAH font siap agar tidak ter-render dengan fallback.
 */

export const GAME_FONT = '"Press Start 2P", "Courier New", monospace';
const FONT_LOAD_TIMEOUT_MS = 3000;

let fontsReady = false;

/** Tunggu Press Start 2P siap; fallback diam-diam setelah timeout. */
export function ensureFontsLoaded(): Promise<void> {
    if (fontsReady) return Promise.resolve();
    const load = document.fonts
        .load('16px "Press Start 2P"')
        .then(() => undefined)
        .catch(() => undefined);
    const timeout = new Promise<void>((resolve) => {
        window.setTimeout(resolve, FONT_LOAD_TIMEOUT_MS);
    });
    return Promise.race([load, timeout]).then(() => {
        fontsReady = true;
    });
}

export interface GameTextOptions {
    color?: string;
    align?: 'left' | 'center' | 'right';
    wordWrapWidth?: number;
    lineSpacing?: number;
}

/**
 * Buat Phaser Text tajam: Press Start 2P, resolution 2 (backing 2560x1440),
 * posisi dibulatkan ke integer. Ukuran font adalah ukuran final — jangan
 * di-setScale (aturan RENDERING_QUALITY_BASELINE).
 */
export function makeText(
    scene: Scene,
    x: number,
    y: number,
    text: string,
    fontSize: number,
    options: GameTextOptions = {}
): GameObjects.Text {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
        fontFamily: GAME_FONT,
        fontSize: `${Math.round(fontSize)}px`,
        color: options.color ?? '#3a0a52',
        align: options.align ?? 'left',
        resolution: 2,
        padding: { x: 2, y: 4 }
    };
    if (options.wordWrapWidth) {
        style.wordWrap = { width: options.wordWrapWidth };
    }
    const obj = scene.add.text(Math.round(x), Math.round(y), text, style);
    if (options.lineSpacing !== undefined) {
        obj.setLineSpacing(options.lineSpacing);
    }
    return obj;
}
