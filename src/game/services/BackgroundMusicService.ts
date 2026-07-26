import type { Scene } from 'phaser';
import { SettingsStorageService } from './SettingsStorageService';

export const BACKGROUND_MUSIC_KEY = 'backsound-game';

const BACKGROUND_MUSIC_VOLUME = 0.4;

function applyStoredMute(scene: Scene): void {
    scene.sound.mute = SettingsStorageService.getSettings().muted;
}

function createAndPlay(scene: Scene): void {
    scene.sound.add(BACKGROUND_MUSIC_KEY, {
        loop: true,
        volume: BACKGROUND_MUSIC_VOLUME
    }).play();
}

export const BackgroundMusicService = {
    /**
     * Menjaga satu instance backsound tetap berjalan ketika pemain berada di
     * flow permainan. Pemanggilan ulang tidak mengubah posisi putar.
     */
    ensurePlaying(scene: Scene): void {
        applyStoredMute(scene);
        if (!scene.cache.audio.exists(BACKGROUND_MUSIC_KEY)) return;
        if (scene.sound.isPlaying(BACKGROUND_MUSIC_KEY)) return;

        scene.sound.removeByKey(BACKGROUND_MUSIC_KEY);
        createAndPlay(scene);
    },

    /**
     * Setiap level/replay harus dimulai dari detik nol tanpa menyisakan
     * instance musik dari level sebelumnya.
     */
    restartForLevel(scene: Scene): void {
        applyStoredMute(scene);
        if (!scene.cache.audio.exists(BACKGROUND_MUSIC_KEY)) return;

        scene.sound.removeByKey(BACKGROUND_MUSIC_KEY);
        createAndPlay(scene);
    },

    stop(scene: Scene): void {
        scene.sound.removeByKey(BACKGROUND_MUSIC_KEY);
    },

    setMuted(scene: Scene, muted: boolean): void {
        scene.sound.mute = muted;
    }
};
