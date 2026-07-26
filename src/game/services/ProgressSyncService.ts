import { LocalProgress, ProgressStorageService, TOTAL_LEVELS } from './ProgressStorageService';
import { getSupabaseClient } from './SupabaseClient';

type SyncAction =
    | {
        id: string;
        kind: 'record_level_result';
        levelId: number;
        runStars: number;
        createdAt: string;
    }
    | {
        id: string;
        kind: 'mark_intro_seen';
        characterId: string;
        createdAt: string;
    }
    | {
        id: string;
        kind: 'unlock_jejak_pandawa';
        createdAt: string;
    }
    | {
        id: string;
        kind: 'record_jejak_result';
        runScore: number;
        createdAt: string;
    };

const QUEUE_PREFIX = 'sikapandawa.syncQueue.';
const QUEUE_ACCOUNTS_KEY = 'sikapandawa.syncAccounts';
const activeFlushes = new Map<string, Promise<boolean>>();
let initialized = false;

function queueKey(accountId: string): string {
    return `${QUEUE_PREFIX}${accountId}`;
}

function createQueueId(): string {
    if (window.crypto && 'randomUUID' in window.crypto) {
        return window.crypto.randomUUID();
    }
    return `sync-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isSyncAction(value: unknown): value is SyncAction {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.kind !== 'string') {
        return false;
    }
    if (value.kind === 'record_level_result') {
        return Number.isInteger(value.levelId) && Number.isInteger(value.runStars);
    }
    if (value.kind === 'mark_intro_seen') {
        return typeof value.characterId === 'string';
    }
    if (value.kind === 'unlock_jejak_pandawa') return true;
    if (value.kind === 'record_jejak_result') {
        return Number.isInteger(value.runScore);
    }
    return false;
}

function safeRead(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeWrite(key: string, value: string): boolean {
    try {
        window.localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

function readQueue(accountId: string): SyncAction[] {
    const raw = safeRead(queueKey(accountId));
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isSyncAction) : [];
    } catch {
        return [];
    }
}

function rememberAccount(accountId: string): void {
    const raw = safeRead(QUEUE_ACCOUNTS_KEY);
    let accountIds: string[] = [];
    try {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
            accountIds = parsed.filter((item): item is string => typeof item === 'string');
        }
    } catch {
        accountIds = [];
    }
    if (!accountIds.includes(accountId)) {
        accountIds.push(accountId);
        safeWrite(QUEUE_ACCOUNTS_KEY, JSON.stringify(accountIds));
    }
}

function writeQueue(accountId: string, queue: SyncAction[]): boolean {
    rememberAccount(accountId);
    return safeWrite(queueKey(accountId), JSON.stringify(queue));
}

function compactQueue(queue: SyncAction[], incoming: SyncAction): SyncAction[] {
    if (incoming.kind === 'record_level_result') {
        const existing = queue.find(
            (item): item is Extract<SyncAction, { kind: 'record_level_result' }> =>
                item.kind === incoming.kind && item.levelId === incoming.levelId
        );
        if (existing) {
            existing.runStars = Math.max(existing.runStars, incoming.runStars);
            return queue;
        }
    }
    if (incoming.kind === 'mark_intro_seen') {
        if (queue.some(
            (item) => item.kind === incoming.kind
                && item.characterId === incoming.characterId
        )) return queue;
    }
    if (incoming.kind === 'unlock_jejak_pandawa') {
        if (queue.some((item) => item.kind === incoming.kind)) return queue;
    }
    if (incoming.kind === 'record_jejak_result') {
        const existing = queue.find(
            (item): item is Extract<SyncAction, { kind: 'record_jejak_result' }> =>
                item.kind === incoming.kind
        );
        if (existing) {
            existing.runScore = Math.max(existing.runScore, incoming.runScore);
            return queue;
        }
    }
    queue.push(incoming);
    return queue;
}

function actionPriority(action: SyncAction): number {
    if (action.kind === 'record_level_result') return 0;
    if (action.kind === 'mark_intro_seen') return 1;
    if (action.kind === 'unlock_jejak_pandawa') return 2;
    return 3;
}

function parseRemoteProgress(value: unknown): LocalProgress | null {
    if (!isRecord(value)) return null;
    const levelStarsRaw = value.levelStars;
    const levelStars: Record<number, number> = {};
    for (let level = 1; level <= TOTAL_LEVELS; level++) {
        const rawValue = isRecord(levelStarsRaw)
            ? Number(levelStarsRaw[String(level)])
            : 0;
        levelStars[level] = Number.isFinite(rawValue)
            ? Math.max(0, Math.min(3, Math.floor(rawValue)))
            : 0;
    }
    const introSeen = Array.isArray(value.introSeen)
        ? value.introSeen.filter((item): item is string => typeof item === 'string')
        : [];
    const completedLevels = Array.isArray(value.completedLevels)
        ? value.completedLevels
            .map(Number)
            .filter((item) => Number.isInteger(item) && item >= 1 && item <= TOTAL_LEVELS)
        : [];
    return {
        highestUnlockedLevel: Math.max(
            1,
            Math.min(TOTAL_LEVELS, Math.floor(Number(value.highestUnlockedLevel) || 1))
        ),
        levelStars,
        introSeen: Array.from(new Set(introSeen)).sort(),
        completedLevels: Array.from(new Set(completedLevels)).sort((a, b) => a - b),
        jejakPandawaUnlocked: value.jejakPandawaUnlocked === true,
        jejakPandawaBestScore: Math.max(
            0,
            Math.min(10, Math.floor(Number(value.jejakPandawaBestScore) || 0))
        )
    };
}

async function sendAction(action: SyncAction): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    if (action.kind === 'record_level_result') {
        const { error } = await client.rpc('record_level_result', {
            level_id: action.levelId,
            run_stars: action.runStars
        });
        return error === null;
    }
    if (action.kind === 'mark_intro_seen') {
        const { error } = await client.rpc('mark_intro_seen', {
            character_id: action.characterId
        });
        return error === null;
    }
    if (action.kind === 'unlock_jejak_pandawa') {
        const { error } = await client.rpc('unlock_jejak_pandawa');
        return error === null;
    }
    const { error } = await client.rpc('record_jejak_result', {
        run_score: action.runScore
    });
    return error === null;
}

async function flushInternal(accountId: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client || !navigator.onLine) return false;
    const { data } = await client.auth.getSession();
    if (data.session?.user.id !== accountId) return false;

    while (true) {
        const action = readQueue(accountId).sort(
            (a, b) => actionPriority(a) - actionPriority(b)
        )[0];
        if (!action) return true;

        let sent = false;
        try {
            sent = await sendAction(action);
        } catch {
            sent = false;
        }
        if (!sent) return false;

        const latestQueue = readQueue(accountId);
        const current = latestQueue.find((item) => item.id === action.id);
        const changedWhileSending =
            current?.kind === 'record_level_result'
            && action.kind === 'record_level_result'
            && current.runStars > action.runStars
            || current?.kind === 'record_jejak_result'
            && action.kind === 'record_jejak_result'
            && current.runScore > action.runScore;
        const remaining = changedWhileSending
            ? latestQueue
            : latestQueue.filter((item) => item.id !== action.id);
        if (!writeQueue(accountId, remaining)) return false;
    }
}

function enqueueSnapshot(accountId: string, progress: LocalProgress): void {
    for (let level = 1; level <= TOTAL_LEVELS; level++) {
        if (progress.completedLevels.includes(level) || (progress.levelStars[level] ?? 0) > 0) {
            ProgressSyncService.enqueueLevelResult(
                accountId,
                level,
                progress.levelStars[level] ?? 0
            );
        }
    }
    for (const characterId of progress.introSeen) {
        ProgressSyncService.enqueueIntroSeen(accountId, characterId);
    }
    if (progress.jejakPandawaUnlocked) {
        ProgressSyncService.enqueueJejakUnlock(accountId);
    }
    if (progress.jejakPandawaBestScore > 0) {
        ProgressSyncService.enqueueJejakResult(
            accountId,
            progress.jejakPandawaBestScore
        );
    }
}

function makeBaseAction(): Pick<SyncAction, 'id' | 'createdAt'> {
    return {
        id: createQueueId(),
        createdAt: new Date().toISOString()
    };
}

export const ProgressSyncService = {
    initialize(): void {
        if (initialized) return;
        initialized = true;
        window.addEventListener('online', () => {
            const raw = safeRead(QUEUE_ACCOUNTS_KEY);
            try {
                const parsed: unknown = raw ? JSON.parse(raw) : [];
                if (Array.isArray(parsed)) {
                    for (const accountId of parsed) {
                        if (typeof accountId === 'string') void this.flush(accountId);
                    }
                }
            } catch {
                // Queue tetap tersimpan; hydrate berikutnya akan mencoba lagi.
            }
        });
    },

    enqueueLevelResult(accountId: string, levelId: number, runStars: number): void {
        const action: SyncAction = {
            ...makeBaseAction(),
            kind: 'record_level_result',
            levelId,
            runStars
        };
        writeQueue(accountId, compactQueue(readQueue(accountId), action));
        void this.flush(accountId);
    },

    enqueueIntroSeen(accountId: string, characterId: string): void {
        const action: SyncAction = {
            ...makeBaseAction(),
            kind: 'mark_intro_seen',
            characterId,
        };
        writeQueue(accountId, compactQueue(readQueue(accountId), action));
        void this.flush(accountId);
    },

    enqueueJejakUnlock(accountId: string): void {
        const action: SyncAction = {
            ...makeBaseAction(),
            kind: 'unlock_jejak_pandawa'
        };
        writeQueue(accountId, compactQueue(readQueue(accountId), action));
        void this.flush(accountId);
    },

    enqueueJejakResult(accountId: string, runScore: number): void {
        const action: SyncAction = {
            ...makeBaseAction(),
            kind: 'record_jejak_result',
            runScore
        };
        writeQueue(accountId, compactQueue(readQueue(accountId), action));
        void this.flush(accountId);
    },

    flush(accountId: string): Promise<boolean> {
        const existing = activeFlushes.get(accountId);
        if (existing) return existing;
        const running = flushInternal(accountId).finally(() => {
            activeFlushes.delete(accountId);
        });
        activeFlushes.set(accountId, running);
        return running;
    },

    async hydrate(accountId: string): Promise<LocalProgress> {
        const local = ProgressStorageService.getProgress(accountId);
        const client = getSupabaseClient();
        if (!client || !navigator.onLine) return local;

        enqueueSnapshot(accountId, local);
        await this.flush(accountId);

        const { data, error } = await client.rpc('read_complete_progress');
        if (error || !data) return local;
        const remote = parseRemoteProgress(data);
        if (!remote) return local;
        const merged = ProgressStorageService.mergeProgress(local, remote);
        ProgressStorageService.saveProgress(accountId, merged);
        return merged;
    }
};
