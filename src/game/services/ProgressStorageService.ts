/**
 * ProgressStorageService — satu-satunya gerbang localStorage untuk progress pemain.
 */

export interface LocalProgress {
    highestUnlockedLevel: number;
    levelStars: Record<number, number>;
    jejakPandawaUnlocked: boolean;
}

const PROGRESS_KEY_PREFIX = 'sikapandawa.progress.';
export const TOTAL_LEVELS = 10;

function progressKey(accountId: string): string {
    return `${PROGRESS_KEY_PREFIX}${accountId}`;
}

function initialProgress(): LocalProgress {
    const levelStars: Record<number, number> = {};
    for (let level = 1; level <= TOTAL_LEVELS; level++) {
        levelStars[level] = 0;
    }
    return {
        highestUnlockedLevel: 1,
        levelStars,
        jejakPandawaUnlocked: false
    };
}

/** Bersihkan data mentah dari storage agar selalu berbentuk LocalProgress valid. */
function sanitize(raw: unknown): LocalProgress {
    const progress = initialProgress();
    if (typeof raw !== 'object' || raw === null) return progress;
    const candidate = raw as Record<string, unknown>;

    const unlocked = Number(candidate.highestUnlockedLevel);
    if (Number.isFinite(unlocked)) {
        progress.highestUnlockedLevel = Math.max(1, Math.min(TOTAL_LEVELS, Math.floor(unlocked)));
    }

    const stars = candidate.levelStars;
    if (typeof stars === 'object' && stars !== null) {
        for (let level = 1; level <= TOTAL_LEVELS; level++) {
            const value = Number((stars as Record<string, unknown>)[level]);
            if (Number.isFinite(value)) {
                progress.levelStars[level] = Math.max(0, Math.min(3, Math.floor(value)));
            }
        }
    }

    progress.jejakPandawaUnlocked = candidate.jejakPandawaUnlocked === true;
    return progress;
}

export const ProgressStorageService = {
    /** Ambil progress akun; bila belum ada atau rusak, kembalikan progress awal. */
    getProgress(accountId: string): LocalProgress {
        let raw: string | null = null;
        try {
            raw = window.localStorage.getItem(progressKey(accountId));
        } catch {
            return initialProgress();
        }
        if (!raw) return initialProgress();
        try {
            return sanitize(JSON.parse(raw));
        } catch {
            return initialProgress();
        }
    },

    saveProgress(accountId: string, progress: LocalProgress): boolean {
        try {
            window.localStorage.setItem(progressKey(accountId), JSON.stringify(progress));
            return true;
        } catch {
            return false;
        }
    },

    /** Dipanggil saat register: pastikan progress awal tersimpan. */
    createInitialProgress(accountId: string): boolean {
        return this.saveProgress(accountId, initialProgress());
    },

    totalStars(progress: LocalProgress): number {
        let total = 0;
        for (let level = 1; level <= TOTAL_LEVELS; level++) {
            total += progress.levelStars[level] ?? 0;
        }
        return total;
    }
};
