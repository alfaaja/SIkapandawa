import type { ParentBackend, ParentContext } from './backend';
import { appendDemoEntry, DEMO_STUDENT, demoEntries, demoHistory } from '../shared/monitoringDemo';
import { parseMonitoringScores } from '../shared/monitoring';
const SESSION = 'sikapandawa.parent.demo';
export function createParentMockBackend(): ParentBackend {
    const context = (): ParentContext => ({ userId: DEMO_STUDENT, username: 'arjuna.pratama', displayName: 'Arjuna Pratama', schoolName: 'SDN Kalibanteng Kulon 01',
        completedPoints: [...new Set(demoEntries().filter(row => row.userId === DEMO_STUDENT).map(row => row.pointNumber))].sort((a, b) => a - b) });
    return {
        async login(username, password) {
            if (username !== 'arjuna.pratama' || password !== 'local-test-only') throw new Error('Username atau password salah.');
            sessionStorage.setItem(SESSION, 'active'); return context();
        },
        async restore() { return sessionStorage.getItem(SESSION) ? context() : null; },
        async logout() { sessionStorage.removeItem(SESSION); },
        async submit(input, id) {
            if (!sessionStorage.getItem(SESSION)) throw new Error('Sesi berakhir.');
            appendDemoEntry({ ...input, scores: parseMonitoringScores(input.scores), id, userId: DEMO_STUDENT, createdAt: new Date().toISOString() });
        },
        async history(offset) { if (!sessionStorage.getItem(SESSION)) throw new Error('Sesi berakhir.'); return demoHistory(DEMO_STUDENT, offset); }
    };
}
