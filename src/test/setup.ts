import { afterEach, vi } from 'vitest';

afterEach(() => {
    if (typeof document !== 'undefined') document.body.replaceChildren();
    if (typeof window !== 'undefined') {
        window.localStorage.clear();
        window.sessionStorage.clear();
    }
    vi.useRealTimers();
    vi.unstubAllGlobals();
});
