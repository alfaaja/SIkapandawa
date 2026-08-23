import { AdminMutationError } from './handler.ts';

export function safeMutationFailure(error: unknown): AdminMutationError {
    const message = typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : '';

    if (/duplicate|already|unique/i.test(message)) {
        return new AdminMutationError(409, 'Username sudah digunakan');
    }
    if (/conflict|changed|stale/i.test(message)) {
        return new AdminMutationError(
            409,
            'Data akun telah berubah. Muat ulang dan coba lagi',
        );
    }
    if (/not found|no rows/i.test(message)) {
        return new AdminMutationError(404, 'Akun pemain tidak ditemukan');
    }
    return new AdminMutationError(503, 'Layanan akun sementara tidak tersedia');
}
