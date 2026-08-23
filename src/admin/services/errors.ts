import type { AdminBackendError } from './AdminSupabaseClient';

export type AdminErrorCode =
    | 'access_denied'
    | 'invalid_credentials'
    | 'invalid_response'
    | 'not_found'
    | 'offline'
    | 'rate_limited'
    | 'session_expired'
    | 'validation'
    | 'conflict'
    | 'generic';

const ERROR_MESSAGES: Record<AdminErrorCode, string> = {
    access_denied: 'Akun tidak memiliki akses admin',
    invalid_credentials: 'Nama pengguna atau password salah.',
    invalid_response: 'Data panel admin tidak valid. Silakan coba lagi.',
    not_found: 'Data pemain tidak ditemukan.',
    offline: 'Tidak ada koneksi internet. Periksa jaringan lalu coba lagi.',
    rate_limited: 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
    session_expired: 'Sesi telah berakhir. Silakan masuk kembali.',
    validation: 'Periksa kembali data akun yang dimasukkan.',
    conflict: 'Data akun telah berubah atau username sudah digunakan.',
    generic: 'Panel admin tidak dapat dimuat. Silakan coba lagi.'
};

export class AdminServiceError extends Error {
    readonly code: AdminErrorCode;

    constructor(code: AdminErrorCode) {
        super(ERROR_MESSAGES[code]);
        this.name = 'AdminServiceError';
        this.code = code;
    }
}

export function classifyBackendError(error: AdminBackendError): AdminServiceError {
    if (!navigator.onLine) return new AdminServiceError('offline');
    if (error.status === 429 || error.code === 'over_request_rate_limit') {
        return new AdminServiceError('rate_limited');
    }
    if (error.status === 403 || error.code === '42501' || error.code === 'PGRST301') {
        return new AdminServiceError('access_denied');
    }
    if (error.status === 401 || error.code === 'PGRST303') {
        return new AdminServiceError('session_expired');
    }
    if (error.status === 404 || error.code === 'P0002') {
        return new AdminServiceError('not_found');
    }
    if (error.status === 409 || error.code === '23505') {
        return new AdminServiceError('conflict');
    }
    if (error.status === 400 || error.status === 422 || error.code === '22023') {
        return new AdminServiceError('validation');
    }
    return new AdminServiceError('generic');
}
