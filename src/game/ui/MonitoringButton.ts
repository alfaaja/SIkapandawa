import type { Scene } from 'phaser';
import { SpriteButton } from './SpriteButton';
import { makeText } from './fonts';

export function addMonitoringButton(scene: Scene, x: number, y: number, name: string, onClick = () => window.location.assign('/form/')): SpriteButton {
    const key = 'button-monitoring';
    if (!scene.textures.exists(key)) {
        const graphics = scene.add.graphics();
        // Stepped edges and palette follow the existing authentication buttons.
        for (const [color, inset] of [[0x383241, 0], [0xb4a5c1, 4], [0x9441c0, 8]]) {
            graphics.fillStyle(color, 1);
            graphics.fillRect(inset + 6, inset, 158 - 2 * inset - 12, 54 - 2 * inset);
            graphics.fillRect(inset, inset + 6, 158 - 2 * inset, 54 - 2 * inset - 12);
        }
        graphics.generateTexture(key, 158, 54); graphics.destroy();
    }
    const button = new SpriteButton(scene, x, y, key, onClick); button.image.setName(name);
    makeText(scene, x, y, 'MONITORING', 12, { color:'#ffffff',align:'center' }).setOrigin(0.5).setName(name + '-label');
    return button;
}
