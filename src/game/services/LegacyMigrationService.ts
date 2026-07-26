import { LocalAccount, AuthStorageService } from './AuthStorageService';
import { LocalProgress, ProgressStorageService } from './ProgressStorageService';
import { ProgressSyncService } from './ProgressSyncService';

const MAPPING_PREFIX = 'sikapandawa.legacyAccountMapping.';

function mappingKey(legacyAccountId: string): string {
    return `${MAPPING_PREFIX}${legacyAccountId}`;
}

function safeSet(key: string, value: string): boolean {
    try {
        window.localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

function remoteCoversLocal(remote: LocalProgress, local: LocalProgress): boolean {
    if (remote.highestUnlockedLevel < local.highestUnlockedLevel) return false;
    if (remote.jejakPandawaBestScore < local.jejakPandawaBestScore) return false;
    if (local.jejakPandawaUnlocked && !remote.jejakPandawaUnlocked) return false;
    if (local.introSeen.some((item) => !remote.introSeen.includes(item))) return false;
    if (local.completedLevels.some((item) => !remote.completedLevels.includes(item))) {
        return false;
    }
    for (let level = 1; level <= 10; level++) {
        if ((remote.levelStars[level] ?? 0) < (local.levelStars[level] ?? 0)) {
            return false;
        }
    }
    return true;
}

export const LegacyMigrationService = {
    async migrate(legacyAccount: LocalAccount, remoteAccountId: string): Promise<boolean> {
        const legacyProgress = ProgressStorageService.getProgress(legacyAccount.id);
        ProgressStorageService.copyProgress(legacyAccount.id, remoteAccountId);

        const hydrated = await ProgressSyncService.hydrate(remoteAccountId);
        if (!remoteCoversLocal(hydrated, legacyProgress)) return false;
        if (!safeSet(mappingKey(legacyAccount.id), remoteAccountId)) return false;

        // Kredensial dibersihkan paling akhir; progress legacy tetap menjadi backup.
        return AuthStorageService.removeLegacyCredentials(legacyAccount.id);
    }
};
