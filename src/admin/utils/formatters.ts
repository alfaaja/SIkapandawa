const FALLBACK = '—';
const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta'
});

export function formatDateTime(value: string | null | undefined): string {
    if (!value) return FALLBACK;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return FALLBACK;
    return dateTimeFormatter.format(date);
}

export function formatStatus(status: string): string {
    if (status === 'not_started') return 'Belum mulai';
    if (status === 'in_progress') return 'Sedang bermain';
    if (status === 'completed') return 'Selesai';
    return 'Tidak diketahui';
}
