import { Scene } from 'phaser';

export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

/**
 * Pasang background dari texture; bila asset gagal dimuat,
 * gambar gradien kuning sebagai fallback agar tidak ada layar hitam.
 */
export function addBackground(scene: Scene, textureKey: string): void {
    if (scene.textures.exists(textureKey)) {
        scene.add.image(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, textureKey);
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
