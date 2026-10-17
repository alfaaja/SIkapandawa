// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { JEJAK_CARDS } from '../data/jejakPandawa';
import type { JejakAnswer } from '../../shared/game/characterAspects';
import { CHARACTER_ASPECTS } from '../../shared/game/characterAspects';

const backend = vi.hoisted(() => ({ rpc: vi.fn(), headers: vi.fn(), auth: { getSession: vi.fn() } }));
vi.mock('./SupabaseClient', () => ({ getSupabaseClient: () => backend }));
const accountId = 'student';
const v2QueueKey = `sikapandawa.jejakV2Queue.${accountId}`;
function response(error: unknown = null) {
    const result = Promise.resolve({ error });
    return Object.assign(result, { setHeader(name: string, value: string) { backend.headers(name, value); return result; } });
}
const answers: JejakAnswer[] = CHARACTER_ASPECTS.flatMap(aspect => JEJAK_CARDS.filter(card => card.aspect === aspect.id).slice(0,2)).map(card => ({ cardId: card.id, basket: card.isGood ? 'good' : 'bad' }));
beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('navigator', { onLine: false });
    backend.rpc.mockReset().mockImplementation(() => response());
    backend.headers.mockClear();
    backend.auth.getSession.mockReset().mockResolvedValue({ data: { session: { user: { id: accountId }, access_token: 'test-token-a' } } });
});

it('keeps complete runs separate offline, then sends every answer without inventing aspect scores', async () => {
    const { ProgressSyncService: sync } = await import('./ProgressSyncService');
    sync.enqueueJejakAnswers(accountId, answers);
    sync.enqueueJejakAnswers(accountId, answers.map(answer => ({ ...answer, basket: 'bad' })));
    expect(JSON.parse(localStorage.getItem(v2QueueKey) ?? '[]').length).toBe(2);
    await sync.flush(accountId);
    vi.stubGlobal('navigator', { onLine: true });
    await sync.flush(accountId);
    expect(backend.rpc).toHaveBeenCalledTimes(2);
    expect(backend.rpc).toHaveBeenNthCalledWith(1, 'record_jejak_aspect_result_v2', { submission_id: expect.any(String), run_answers: answers });
    expect(JSON.parse(localStorage.getItem(v2QueueKey)!)).toEqual([]);
});

it('keeps the submission UUID after a failed v2 attempt and still sends a saved v1 queue through its old RPC', async () => {
    const { ProgressSyncService: sync } = await import('./ProgressSyncService');
    sync.enqueueJejakAnswers(accountId, answers);
    const pending = JSON.parse(localStorage.getItem(v2QueueKey) ?? '[]')[0];
    await sync.flush(accountId);
    backend.rpc.mockReturnValueOnce(response({ message: 'lost receipt' }));
    vi.stubGlobal('navigator', { onLine: true });
    await sync.flush(accountId); await sync.flush(accountId);
    expect(backend.rpc).toHaveBeenNthCalledWith(1, 'record_jejak_aspect_result_v2', { submission_id: pending.id, run_answers: answers });
    expect(backend.rpc).toHaveBeenNthCalledWith(2, 'record_jejak_aspect_result_v2', { submission_id: pending.id, run_answers: answers });
    const legacy = ['yudhistira','bima','arjuna','nakula','sadewa'].flatMap(character => [1,2].map(index => ({ cardId: character+'-0'+index,basket:'good' })));
    localStorage.setItem(`sikapandawa.syncQueue.${accountId}`, JSON.stringify([{ id: 'legacy-id',kind:'record_jejak_aspect_result',answers:legacy,createdAt:'2026-10-15T00:00:00Z' }]));
    await sync.flush(accountId);
    expect(backend.rpc).toHaveBeenLastCalledWith('record_jejak_aspect_result',{ run_answers: legacy });
});

it('retains an unsuccessful detailed submission for retry and still supports old total-only actions', async () => {
    const { ProgressSyncService: sync } = await import('./ProgressSyncService');
    sync.enqueueJejakResult(accountId, 9);
    sync.enqueueJejakAnswers(accountId, answers);
    await sync.flush(accountId);
    backend.rpc.mockReturnValueOnce(response()).mockReturnValueOnce(response({ message: 'offline' }));
    vi.stubGlobal('navigator', { onLine: true });
    await sync.flush(accountId);
    expect(backend.rpc).toHaveBeenCalledWith('record_jejak_result', { run_score: 9 });
    expect(JSON.parse(localStorage.getItem(v2QueueKey)!)).toHaveLength(1);
});

it('pins each RPC to the owner token and stops the queue when another account signs in', async () => {
    const { ProgressSyncService: sync } = await import('./ProgressSyncService');
    sync.enqueueJejakAnswers(accountId, answers);
    sync.enqueueJejakAnswers(accountId, answers);
    await sync.flush(accountId);
    backend.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: accountId }, access_token: 'test-token-a' } } })
        .mockResolvedValue({ data: { session: { user: { id: 'another-student' }, access_token: 'test-token-b' } } });
    vi.stubGlobal('navigator', { onLine: true });
    await sync.flush(accountId);
    expect(backend.rpc).toHaveBeenCalledTimes(1);
    expect(backend.headers).toHaveBeenCalledWith('Authorization', 'Bearer test-token-a');
    expect(JSON.parse(localStorage.getItem(v2QueueKey)!)).toHaveLength(1);
});

it('does not lose detailed v2 answers when an older tab rewrites its legacy queue', async () => {
    const { ProgressSyncService: sync } = await import('./ProgressSyncService');
    sync.enqueueJejakAnswers(accountId, answers); await sync.flush(accountId);
    // A v1 tab filters unknown action kinds and saves only its recognized queue.
    localStorage.setItem(`sikapandawa.syncQueue.${accountId}`, '[]');
    vi.stubGlobal('navigator', { onLine: true });
    await sync.flush(accountId);
    expect(backend.rpc).toHaveBeenCalledWith('record_jejak_aspect_result_v2', { submission_id: expect.any(String), run_answers: answers });
    expect(JSON.parse(localStorage.getItem(v2QueueKey)!)).toEqual([]);
});

it('does not read or cache another account progress when hydration changes session', async () => {
    const { ProgressSyncService: sync } = await import('./ProgressSyncService');
    backend.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'another-student' }, access_token: 'test-token-b' } } });
    vi.stubGlobal('navigator', { onLine: true });
    const progress = await sync.hydrate(accountId);
    expect(progress.jejakPandawaBestScore).toBe(0);
    expect(backend.rpc).not.toHaveBeenCalled();
});

it('pins the progress read to the session owner during hydration', async () => {
    const { ProgressSyncService: sync } = await import('./ProgressSyncService');
    vi.stubGlobal('navigator', { onLine: true });
    await sync.hydrate(accountId);
    expect(backend.rpc).toHaveBeenCalledWith('read_complete_progress');
    expect(backend.headers).toHaveBeenCalledWith('Authorization', 'Bearer test-token-a');
});
