import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

const configured = supabaseUrl.length > 0 && publishableKey.length > 0;
let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
    return configured;
}

export function isLocalFallbackAllowed(): boolean {
    return import.meta.env.DEV && !configured;
}

export function getSupabaseClient(): SupabaseClient | null {
    if (!configured) return null;
    if (!client) {
        client = createClient(supabaseUrl, publishableKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false
            }
        });
    }
    return client;
}

export function getSupabaseConfigurationError(): string {
    return 'Konfigurasi layanan akun belum tersedia. Hubungi pendamping permainan.';
}
