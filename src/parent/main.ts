import { createMonitoringPortalBackend } from '../monitoring/backend';
import { MonitoringPortal } from '../monitoring/MonitoringPortal';

async function start() {
    const root = document.querySelector<HTMLElement>('#parent-app');
    if (!root) return;
    try {
        const backend = import.meta.env.DEV && new URLSearchParams(location.search).get('mockMonitoring') === '1'
            ? (await import('../monitoring/mock')).createMonitoringPortalMock() : createMonitoringPortalBackend();
        await new MonitoringPortal(root, backend).start();
    } catch (error) { root.textContent = error instanceof Error ? error.message : 'Monitoring belum dapat dimuat.'; }
}
void start();
