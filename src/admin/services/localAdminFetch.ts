/** Development only: keep account mutations on the local Vite origin. */
export function createLocalAdminFetch(projectUrl: string, localOrigin: string, fetcher: typeof fetch = globalThis.fetch): typeof fetch {
    const project = new URL(projectUrl).origin;
    return (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (url.origin !== project || url.pathname !== '/functions/v1/admin-users' || url.search) return fetcher(input, init);
        const target = localOrigin + '/__admin_api/admin-users';
        return fetcher(input instanceof Request ? new Request(target, input) : target, init);
    };
}
