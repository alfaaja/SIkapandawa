import { expect, it, vi } from 'vitest';
import { createLocalAdminFetch } from './localAdminFetch';

it('routes only the configured admin mutation endpoint through the local development proxy', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
    const request = createLocalAdminFetch('https://fixture.supabase.co', 'http://127.0.0.1:5173', fetcher);
    const init = { method: 'POST', headers: { Authorization: 'Bearer test-token', 'Idempotency-Key': 'test-intent' }, body: '{}' };
    await request('https://fixture.supabase.co/functions/v1/admin-users', init);
    expect(fetcher).toHaveBeenLastCalledWith('http://127.0.0.1:5173/__admin_api/admin-users', init);
    for (const url of ['https://fixture.supabase.co/auth/v1/token', 'https://fixture.supabase.co/rest/v1/rpc/admin_dashboard_summary', 'https://other.supabase.co/functions/v1/admin-users', 'https://fixture.supabase.co/functions/v1/other']) {
        await request(url, init);
        expect(fetcher).toHaveBeenLastCalledWith(url, init);
    }
});

it('preserves an SDK Request body and authorization when forwarding locally', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
    const request = createLocalAdminFetch('https://fixture.supabase.co', 'http://127.0.0.1:5173', fetcher);
    await request(new Request('https://fixture.supabase.co/functions/v1/admin-users', { method: 'POST', headers: { Authorization: 'Bearer test-token' }, body: '{"action":"delete"}' }));
    const forwarded = fetcher.mock.calls[0][0] as Request;
    expect(forwarded.url).toBe('http://127.0.0.1:5173/__admin_api/admin-users');
    expect(forwarded.headers.get('Authorization')).toBe('Bearer test-token');
    expect(await forwarded.text()).toBe('{"action":"delete"}');
});
