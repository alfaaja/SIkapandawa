/**
 * ProgressStorageService — satu-satunya gerbang localStorage untuk progress pemain.
 */

export interface LocalProgress {
    highestUnlockedLevel: number;
    levelStars: Record<number, number>;
    introSeen: string[];
    jejakPandawaUnlocked: boolean;
}

export interface LevelResultOutcome {
    runStars: number;
    bestStars: number;
    isNewBest: boolean;
    unlockedLevel: number | null;
    saved: boolean;
}

const PROGRESS_KEY_PREFIX = 'sikapandawa.progress.';
export const TOTAL_LEVELS = 10;
/** Level yang memiliki gameplay pada Progress 03. */
export const PLAYABLE_LEVELS = 2;

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
        introSeen: [],
        jejakPandawaUnlocked: false
    };
}

/**
 * Bersihkan data mentah dari storage agar selalu berbentuk LocalProgress valid.
 * Data lama tanpa `introSeen` (Progress 02) dimigrasikan ke array kosong
 * tanpa menghapus field lain — akun dan bintang tidak pernah hilang.
 */
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

    if (Array.isArray(candidate.introSeen)) {
        progress.introSeen = candidate.introSeen.filter(
            (v): v is string => typeof v === 'string'
        );
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
    },

    hasSeenIntro(accountId: string, characterId: string): boolean {
        return this.getProgress(accountId).introSeen.includes(characterId);
    },

    markIntroSeen(accountId: string, characterId: string): void {
        const progress = this.getProgress(accountId);
        if (!progress.introSeen.includes(characterId)) {
            progress.introSeen.push(characterId);
            this.saveProgress(accountId, progress);
        }
    },

    /**
     * Simpan hasil satu run level.
     * - Best score tidak pernah turun (max).
     * - >= 1 bintang membuka level berikutnya; unlock tidak pernah mundur.
     */
    recordLevelResult(accountId: string, levelId: number, runStars: number): LevelResultOutcome {
        const progress = this.getProgress(accountId);
        const clamped = Math.max(0, Math.min(3, Math.floor(runStars)));
        const previousBest = progress.levelStars[levelId] ?? 0;
        const bestStars = Math.max(previousBest, clamped);
        progress.levelStars[levelId] = bestStars;

        let unlockedLevel: number | null = null;
        if (bestStars >= 1 && levelId < TOTAL_LEVELS) {
            const next = levelId + 1;
            if (next > progress.highestUnlockedLevel) {
                progress.highestUnlockedLevel = next;
                unlockedLevel = next;
            }
        }

        const saved = this.saveProgress(accountId, progress);
        return {
            runStars: clamped,
            bestStars,
            isNewBest: bestStars > previousBest,
            unlockedLevel,
            saved
        };
    }
};
