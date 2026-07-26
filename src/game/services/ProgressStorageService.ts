/**
 * ProgressStorageService — satu-satunya gerbang localStorage untuk progress pemain.
 */

export interface LocalProgress {
    highestUnlockedLevel: number;
    levelStars: Record<number, number>;
    introSeen: string[];
    completedLevels: number[];
    jejakPandawaUnlocked: boolean;
    jejakPandawaBestScore: number;
}

export interface LevelResultOutcome {
    runStars: number;
    bestStars: number;
    isNewBest: boolean;
    unlockedLevel: number | null;
    saved: boolean;
}

export interface JejakResultOutcome {
    score: number;
    bestScore: number;
    isNewBest: boolean;
    saved: boolean;
}

const PROGRESS_KEY_PREFIX = 'sikapandawa.progress.';
export const TOTAL_LEVELS = 10;
/** Level yang memiliki gameplay sampai Progress 07. */
export const PLAYABLE_LEVELS = 10;

function progressKey(accountId: string): string {
    return `${PROGRESS_KEY_PREFIX}${accountId}`;
}

export function createEmptyProgress(): LocalProgress {
    const levelStars: Record<number, number> = {};
    for (let level = 1; level <= TOTAL_LEVELS; level++) {
        levelStars[level] = 0;
    }
    return {
        highestUnlockedLevel: 1,
        levelStars,
        introSeen: [],
        completedLevels: [],
        jejakPandawaUnlocked: false,
        jejakPandawaBestScore: 0
    };
}

/**
 * Bersihkan data mentah dari storage agar selalu berbentuk LocalProgress valid.
 * Data lama tanpa `introSeen` (Progress 02) dimigrasikan ke array kosong
 * tanpa menghapus field lain — akun dan bintang tidak pernah hilang.
 */
function sanitize(raw: unknown): LocalProgress {
    const progress = createEmptyProgress();
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

    if (Array.isArray(candidate.completedLevels)) {
        progress.completedLevels = Array.from(new Set(
            candidate.completedLevels
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value) && value >= 1 && value <= TOTAL_LEVELS)
        )).sort((a, b) => a - b);
    }

    progress.jejakPandawaUnlocked = candidate.jejakPandawaUnlocked === true;
    const jejakBest = Number(candidate.jejakPandawaBestScore);
    if (Number.isFinite(jejakBest)) {
        progress.jejakPandawaBestScore = Math.max(0, Math.min(10, Math.floor(jejakBest)));
    }
    return progress;
}

export const ProgressStorageService = {
    /** Ambil progress akun; bila belum ada atau rusak, kembalikan progress awal. */
    getProgress(accountId: string): LocalProgress {
        let raw: string | null = null;
        try {
            raw = window.localStorage.getItem(progressKey(accountId));
        } catch {
            return createEmptyProgress();
        }
        if (!raw) return createEmptyProgress();
        try {
            return sanitize(JSON.parse(raw));
        } catch {
            return createEmptyProgress();
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
        return this.saveProgress(accountId, createEmptyProgress());
    },

    totalStars(progress: LocalProgress): number {
        let total = 0;
        for (let level = 1; level <= TOTAL_LEVELS; level++) {
            total += progress.levelStars[level] ?? 0;
        }
        return total;
    },

    hasCompletedAllLevels(progress: LocalProgress): boolean {
        for (let level = 1; level <= TOTAL_LEVELS; level++) {
            if (!progress.completedLevels.includes(level)) return false;
        }
        return true;
    },

    /**
     * Buka Jejak Pandawa hanya setelah seluruh level selesai.
     * Unlock bersifat monotonic: nilai true tidak pernah diturunkan.
     */
    unlockJejakPandawa(accountId: string): boolean {
        const progress = this.getProgress(accountId);
        if (progress.jejakPandawaUnlocked) return true;
        if (!this.hasCompletedAllLevels(progress)) return false;
        progress.jejakPandawaUnlocked = true;
        return this.saveProgress(accountId, progress);
    },

    recordJejakResult(accountId: string, runScore: number): JejakResultOutcome {
        const progress = this.getProgress(accountId);
        const score = Math.max(0, Math.min(10, Math.floor(runScore)));
        const previousBest = progress.jejakPandawaBestScore;
        progress.jejakPandawaBestScore = Math.max(previousBest, score);
        const saved = this.saveProgress(accountId, progress);
        return {
            score,
            bestScore: progress.jejakPandawaBestScore,
            isNewBest: progress.jejakPandawaBestScore > previousBest,
            saved
        };
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
        if (
            Number.isInteger(levelId)
            && levelId >= 1
            && levelId <= TOTAL_LEVELS
            && !progress.completedLevels.includes(levelId)
        ) {
            progress.completedLevels.push(levelId);
            progress.completedLevels.sort((a, b) => a - b);
        }

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
    },

    mergeProgress(local: LocalProgress, incoming: LocalProgress): LocalProgress {
        const merged = createEmptyProgress();
        merged.highestUnlockedLevel = Math.max(
            local.highestUnlockedLevel,
            incoming.highestUnlockedLevel
        );
        for (let level = 1; level <= TOTAL_LEVELS; level++) {
            merged.levelStars[level] = Math.max(
                local.levelStars[level] ?? 0,
                incoming.levelStars[level] ?? 0
            );
        }
        merged.introSeen = Array.from(new Set([
            ...local.introSeen,
            ...incoming.introSeen
        ])).sort();
        merged.completedLevels = Array.from(new Set([
            ...local.completedLevels,
            ...incoming.completedLevels
        ])).sort((a, b) => a - b);
        merged.jejakPandawaUnlocked =
            local.jejakPandawaUnlocked || incoming.jejakPandawaUnlocked;
        merged.jejakPandawaBestScore = Math.max(
            local.jejakPandawaBestScore,
            incoming.jejakPandawaBestScore
        );
        return merged;
    },

    copyProgress(sourceAccountId: string, targetAccountId: string): LocalProgress {
        const source = this.getProgress(sourceAccountId);
        const target = this.getProgress(targetAccountId);
        const merged = this.mergeProgress(target, source);
        this.saveProgress(targetAccountId, merged);
        return merged;
    }
};
