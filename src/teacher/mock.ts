import type { TeacherBackend } from './backend';
import { appendDemoEntry, DEMO_STUDENT, demoEntries, demoHistory } from '../shared/monitoringDemo';
import { parseMonitoringScores } from '../shared/monitoring';
const SESSION = 'sikapandawa.teacher.demo';
export function createTeacherMockBackend(): TeacherBackend {
    const check = () => { if (!sessionStorage.getItem(SESSION)) throw new Error('Sesi berakhir.'); };
    const roster = () => [{ userId: DEMO_STUDENT, username: 'arjuna.pratama', displayName: 'Arjuna Pratama', schoolName: 'SDN Kalibanteng Kulon 01',
        completedPoints: [...new Set(demoEntries().filter(row => row.userId === DEMO_STUDENT && row.reporterType === 'teacher').map(row => row.pointNumber))] }];
    return {
        async login(username, password) {
            if (username !== 'guru.demo' || password !== 'local-test-only') throw new Error('Username atau password salah.');
            sessionStorage.setItem(SESSION, 'active'); return roster();
        },
        async restore() { return sessionStorage.getItem(SESSION) ? roster() : null; },
        async logout() { sessionStorage.removeItem(SESSION); },
        async submit(userId, input, id) {
            check(); if (userId !== DEMO_STUDENT) throw new Error('Siswa di luar sekolah Anda.');
            appendDemoEntry({ ...input, scores: parseMonitoringScores(input.scores), id, userId, reporterType: 'teacher', createdAt: new Date().toISOString() });
        },
        async history(userId, offset) { check(); if (userId !== DEMO_STUDENT) throw new Error('Siswa di luar sekolah Anda.'); return demoHistory(userId, offset, 'teacher'); }
    };
}
