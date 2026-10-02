export const DEFAULT_SCHOOL_NAME = 'SDN Kalibanteng Kulon 01';
export const MAX_SCHOOL_NAME_LENGTH = 100;

/** A single canonical name prevents casing/spacing variants splitting school statistics. */
export function normalizeSchoolName(value: unknown): string | null {
    if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) return null;
    const name = value.normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase();
    if (name.length < 2 || name.length > MAX_SCHOOL_NAME_LENGTH) return null;
    return name === DEFAULT_SCHOOL_NAME.toUpperCase() ? DEFAULT_SCHOOL_NAME : name;
}
