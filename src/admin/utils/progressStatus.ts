import type { ProgressStatus } from '../types';

export function deriveProgressStatus(completedLevelCount: number): ProgressStatus {
    if (
        !Number.isInteger(completedLevelCount)
        || completedLevelCount < 0
        || completedLevelCount > 10
    ) {
        throw new RangeError('Completed level count must be an integer from 0 to 10');
    }
    if (completedLevelCount === 0) return 'not_started';
    if (completedLevelCount === 10) return 'completed';
    return 'in_progress';
}
