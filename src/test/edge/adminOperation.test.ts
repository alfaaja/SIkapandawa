import { describe, expect, it, vi } from 'vitest';
import { executeAdminOperation } from '../../../supabase/functions/admin-users/operation';

describe('executeAdminOperation', () => {
    it('records a mutation failure as failed and rethrows it', async () => {
        const mutationError = new Error('mutation failed');
        const finish = vi.fn().mockResolvedValue(undefined);

        await expect(executeAdminOperation({
            mutate: vi.fn().mockRejectedValue(mutationError),
            finish
        })).rejects.toBe(mutationError);

        expect(finish).toHaveBeenCalledTimes(1);
        expect(finish).toHaveBeenCalledWith('failed');
    });

    it('never records failed after the privileged mutation already succeeded', async () => {
        const finish = vi.fn().mockRejectedValue(new Error('audit unavailable'));

        await expect(executeAdminOperation({
            mutate: vi.fn().mockResolvedValue({ userId: crypto.randomUUID() }),
            finish
        })).resolves.toEqual(expect.objectContaining({ userId: expect.any(String) }));

        expect(finish).toHaveBeenCalledTimes(3);
        expect(finish).toHaveBeenCalledWith('succeeded');
        expect(finish).not.toHaveBeenCalledWith('failed');
    });

    it('stops retrying as soon as the success audit is durable', async () => {
        const finish = vi.fn()
            .mockRejectedValueOnce(new Error('transient'))
            .mockResolvedValueOnce(undefined);

        await executeAdminOperation({
            mutate: vi.fn().mockResolvedValue({ userId: crypto.randomUUID() }),
            finish
        });

        expect(finish).toHaveBeenCalledTimes(2);
        expect(finish).toHaveBeenNthCalledWith(1, 'succeeded');
        expect(finish).toHaveBeenNthCalledWith(2, 'succeeded');
    });
});
