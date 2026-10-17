import { createParentBackend } from './backend';
import { ParentPage } from './ParentPage';

async function start() {
    const root = document.querySelector<HTMLElement>('#parent-app');
    if (!root) return;
    try {
        const backend = import.meta.env.DEV && new URLSearchParams(location.search).get('mockMonitoring') === '1'
            ? (await import('./mock')).createParentMockBackend() : createParentBackend();
        await new ParentPage(root, backend).start();
    } catch (error) { root.textContent = error instanceof Error ? error.message : 'Monitoring belum dapat dimuat.'; }
}
void start();
