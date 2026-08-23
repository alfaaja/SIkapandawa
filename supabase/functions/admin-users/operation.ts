export type AdminOperationStatus = 'succeeded' | 'failed';

export interface AdminOperationExecution<T> {
    mutate(): Promise<T>;
    finish(status: AdminOperationStatus): Promise<void>;
}

const SUCCESS_FINISH_ATTEMPTS = 3;

/**
 * Keeps the privileged side effect authoritative when the audit transport fails.
 * A successful mutation must never be rewritten as failed merely because its
 * terminal ledger update was temporarily unavailable.
 */
export async function executeAdminOperation<T>(
    execution: AdminOperationExecution<T>
): Promise<T> {
    let result: T;
    try {
        result = await execution.mutate();
    } catch (error) {
        try {
            await execution.finish('failed');
        } catch {
            // Preserve the original mutation error; the pending ledger row is
            // safer than falsely claiming a different terminal outcome.
        }
        throw error;
    }

    for (let attempt = 0; attempt < SUCCESS_FINISH_ATTEMPTS; attempt += 1) {
        try {
            await execution.finish('succeeded');
            break;
        } catch {
            // A retry is safe because the finish RPC only transitions pending
            // rows and returns the already stored terminal row afterwards.
        }
    }
    return result;
}
