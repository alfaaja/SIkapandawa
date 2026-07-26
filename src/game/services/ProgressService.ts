import {
    JejakResultOutcome,
    LevelResultOutcome,
    LocalProgress,
    PLAYABLE_LEVELS,
    ProgressStorageService,
    TOTAL_LEVELS
} from './ProgressStorageService';
import { ProgressSyncService } from './ProgressSyncService';

export { PLAYABLE_LEVELS, TOTAL_LEVELS };
export type { JejakResultOutcome, LevelResultOutcome, LocalProgress };

/**
 * Facade progress untuk seluruh scene. Cache lokal tetap sinkron agar gameplay
 * tidak menunggu jaringan; mutation remote dikirim melalui queue monotonic.
 */
export const ProgressService = {
    getProgress(accountId: string): LocalProgress {
        return ProgressStorageService.getProgress(accountId);
    },

    createInitialProgress(accountId: string): boolean {
        return ProgressStorageService.createInitialProgress(accountId);
    },

    totalStars(progress: LocalProgress): number {
        return ProgressStorageService.totalStars(progress);
    },

    hasCompletedAllLevels(progress: LocalProgress): boolean {
        return ProgressStorageService.hasCompletedAllLevels(progress);
    },

    hasSeenIntro(accountId: string, characterId: string): boolean {
        return ProgressStorageService.hasSeenIntro(accountId, characterId);
    },

    markIntroSeen(accountId: string, characterId: string): void {
        ProgressStorageService.markIntroSeen(accountId, characterId);
        ProgressSyncService.enqueueIntroSeen(accountId, characterId);
    },

    unlockJejakPandawa(accountId: string): boolean {
        const unlocked = ProgressStorageService.unlockJejakPandawa(accountId);
        if (unlocked) ProgressSyncService.enqueueJejakUnlock(accountId);
        return unlocked;
    },

    recordLevelResult(
        accountId: string,
        levelId: number,
        runStars: number
    ): LevelResultOutcome {
        const outcome = ProgressStorageService.recordLevelResult(
            accountId,
            levelId,
            runStars
        );
        ProgressSyncService.enqueueLevelResult(accountId, levelId, outcome.runStars);
        return outcome;
    },

    recordJejakResult(accountId: string, runScore: number): JejakResultOutcome {
        const outcome = ProgressStorageService.recordJejakResult(accountId, runScore);
        ProgressSyncService.enqueueJejakResult(accountId, outcome.score);
        return outcome;
    },

    hydrate(accountId: string): Promise<LocalProgress> {
        return ProgressSyncService.hydrate(accountId);
    },

    flush(accountId: string): Promise<boolean> {
        return ProgressSyncService.flush(accountId);
    }
};
