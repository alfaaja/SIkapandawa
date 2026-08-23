import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminServiceError, classifyBackendError } from './errors';

describe('admin service errors', () => {
    beforeEach(() => {
        vi.stubGlobal('navigator', { onLine: true });
    });

    it.each([
        [{ status: 429, message: 'raw' }, 'rate_limited'],
        [{ code: 'over_request_rate_limit', message: 'raw' }, 'rate_limited'],
        [{ code: '42501', message: 'raw' }, 'access_denied'],
        [{ code: 'PGRST301', message: 'raw' }, 'access_denied'],
        [{ status: 403, message: 'raw' }, 'access_denied'],
        [{ status: 401, message: 'raw' }, 'session_expired'],
        [{ code: 'PGRST303', message: 'raw' }, 'session_expired'],
        [{ status: 404, message: 'raw' }, 'not_found'],
        [{ code: 'P0002', message: 'raw' }, 'not_found'],
        [{ status: 422, message: 'raw' }, 'validation'],
        [{ code: 'XX000', message: 'sensitive database detail' }, 'generic']
    ] as const)('classifies backend error %# without leaking its message', (input, code) => {
        const result = classifyBackendError(input);

        expect(result).toBeInstanceOf(AdminServiceError);
        expect(result.code).toBe(code);
        expect(result.message).not.toContain('sensitive');
    });

    it('prioritizes the offline state', () => {
        vi.stubGlobal('navigator', { onLine: false });

        expect(classifyBackendError({ status: 429, message: 'raw' }).code)
            .toBe('offline');
    });
});
