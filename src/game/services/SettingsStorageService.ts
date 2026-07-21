/**
 * SettingsStorageService — pengaturan global (mute) di key sikapandawa.settings.
 * Audio final belum ada pada Progress 03; state mute disimpan agar konsisten.
 */

export interface LocalSettings {
    muted: boolean;
}

const SETTINGS_KEY = 'sikapandawa.settings';

export const SettingsStorageService = {
    getSettings(): LocalSettings {
        try {
            const raw = window.localStorage.getItem(SETTINGS_KEY);
            if (!raw) return { muted: false };
            const parsed: unknown = JSON.parse(raw);
            if (typeof parsed === 'object' && parsed !== null) {
                return { muted: (parsed as Record<string, unknown>).muted === true };
            }
        } catch {
            // storage tidak tersedia / JSON rusak — pakai default
        }
        return { muted: false };
    },

    setMuted(muted: boolean): void {
        try {
            window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted }));
        } catch {
            // abaikan; state hanya untuk sesi berjalan
        }
    }
};
