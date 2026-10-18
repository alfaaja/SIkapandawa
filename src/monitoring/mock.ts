import { createParentMockBackend } from '../parent/mock';
import { createTeacherMockBackend } from '../teacher/mock';
import type { MonitoringPortalBackend, MonitoringRole } from './backend';
const KEY = 'sikapandawa.monitoring.demo.role';
export function createMonitoringPortalMock(): MonitoringPortalBackend {
    const parent = createParentMockBackend(); const teacher = createTeacherMockBackend();
    const logout = async () => { sessionStorage.removeItem(KEY); await parent.logout(); await teacher.logout(); };
    return {
        parent: { ...parent, logout }, teacher: { ...teacher, logout }, logout,
        async login(username, password) {
            await logout();
            const role: MonitoringRole = username === 'guru.demo' ? 'teacher' : 'parent';
            if (role === 'teacher') await teacher.login(username, password); else await parent.login(username, password);
            sessionStorage.setItem(KEY, role); return role;
        },
        async restore() {
            const role = sessionStorage.getItem(KEY);
            if (role === 'parent' && await parent.restore()) return 'parent';
            if (role === 'teacher' && await teacher.restore()) return 'teacher';
            return null;
        }
    };
}
