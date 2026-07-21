import { Scene } from 'phaser';

/**
 * Koordinat logis game adalah 1280x720. Backing canvas 2560x1440 dengan
 * kamera zoom 2 sehingga tekstur @2x ter-render 1:1 (tajam/HD).
 */
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

/** Pasang kamera logis: zoom 2 dan pusat pada design space 1280x720. */
export function applyLogicalCamera(scene: Scene): void {
    const cam = scene.cameras.main;
    cam.setZoom(2);
    cam.centerOn(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
}

/**
 * Pasang background dari texture (ukuran texture bebas — ditampilkan pada
 * 1280x720 logis). Bila asset gagal dimuat, gambar gradien kuning sebagai
 * fallback agar tidak ada layar hitam.
 */
export function addBackground(scene: Scene, textureKey: string): void {
    if (scene.textures.exists(textureKey)) {
        scene.add.image(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, textureKey)
            .setDisplaySize(DESIGN_WIDTH, DESIGN_HEIGHT);
        return;
    }
    const graphics = scene.add.graphics();
    graphics.fillGradientStyle(0xfff3c4, 0xfff3c4, 0xf5a623, 0xf5a623, 1);
    graphics.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
}

/** Tambahkan image hanya bila texture tersedia (guard asset load error). */
export function addImageIfExists(
    scene: Scene,
    x: number,
    y: number,
    textureKey: string
): Phaser.GameObjects.Image | null {
    if (!scene.textures.exists(textureKey)) return null;
    return scene.add.image(x, y, textureKey);
}
