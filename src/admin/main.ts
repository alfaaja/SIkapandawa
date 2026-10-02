import { AdminDashboardController } from './controllers/AdminDashboardController';
import { AdminAuthService } from './services/AdminAuthService';
import {
    AdminConfigurationError,
    getAdminBackend,
    type AdminBackend
} from './services/AdminSupabaseClient';
import { AdminDashboardService } from './services/AdminDashboardService';
import { AdminUserManagementService } from './services/AdminUserManagementService';
import { AdminServiceError } from './services/errors';
import { DashboardView } from './ui/DashboardView';
import { LoginView } from './ui/LoginView';
import { createElement, replaceContent } from './ui/dom';

async function resolveBackend(demoMode: boolean): Promise<AdminBackend> {
    if (demoMode) {
        const { createAdminMockBackend } = await import('./mocks/AdminMockBackend');
        return createAdminMockBackend();
    }
    return getAdminBackend();
}

function renderUnavailable(root: HTMLElement, message: string): void {
    const main = createElement('main', { className: 'unavailable-layout' });
    const card = createElement('section', { className: 'unavailable-card' });
    const eyebrow = createElement('p', { className: 'eyebrow', text: 'PANEL ADMIN' });
    const title = createElement('h1', { text: 'Layanan belum tersedia' });
    const copy = createElement('p', { className: 'muted', text: message });
    card.append(eyebrow, title, copy);
    main.append(card);
    replaceContent(root, main);
}

async function start(): Promise<void> {
    const root = document.querySelector<HTMLElement>('#admin-app');
    if (!root) throw new Error('Admin app root is missing');

    const params = new URLSearchParams(window.location.search);
    const demoMode = import.meta.env.DEV && params.get('mockAdmin') === '1';
    let backend: AdminBackend;
    try {
        backend = await resolveBackend(demoMode);
    } catch (error) {
        const message = error instanceof AdminConfigurationError
            ? error.message
            : 'Panel admin gagal dimulai.';
        renderUnavailable(root, message);
        return;
    }

    const authService = new AdminAuthService(backend);
    const dashboardService = new AdminDashboardService(backend);
    const userManagementService = new AdminUserManagementService(backend);

    const showLogin = (initialError = ''): void => {
        const loginView = new LoginView(root, async ({ username, password }) => {
            const result = await authService.login(username, password);
            if (!result.ok) {
                loginView.showError(result.error.message);
                return;
            }
            mountDashboard();
        });
        loginView.render();
        if (initialError) loginView.showError(initialError);
    };

    const mountDashboard = (): void => {
        let controller!: AdminDashboardController;
        const runManagementOperation = async <T>(operation: () => Promise<T>): Promise<T> => {
            try {
                return await operation();
            } catch (error) {
                if (
                    error instanceof AdminServiceError
                    && (error.code === 'access_denied' || error.code === 'session_expired')
                ) {
                    await authService.logout().finally(() => showLogin(error.message));
                }
                throw error;
            }
        };
        const view = new DashboardView(root, {
            onDetail: (userId) => void controller.showDetail(userId),
            onCreateUser: (input) => runManagementOperation(
                () => userManagementService.createUser(input)
            ),
            onEditUser: (userId, input) => runManagementOperation(
                () => userManagementService.updateUser(userId, input)
            ),
            onDeleteUser: (userId, expectedUsername) => (
                runManagementOperation(
                    () => userManagementService.deleteUser(userId, expectedUsername)
                )
            ),
            onResetPassword: (userId, password) => (
                runManagementOperation(
                    () => userManagementService.resetPassword(userId, password)
                )
            ),
            onChangeOwnPassword: async (password) => {
                const result = await authService.changeOwnPassword(password);
                if (!result.ok) throw result.error;
            },
            onFilter: (status) => controller.setFilter(status),
            onSchool: (schoolName) => controller.setSchool(schoolName),
            onLogout: () => {
                void authService.logout().finally(() => showLogin());
            },
            onNextPage: () => controller.nextPage(),
            onPreviousPage: () => controller.previousPage(),
            onRefresh: () => void controller.refresh(),
            onSearch: (searchText) => controller.setSearch(searchText)
        }, authService.getCurrentUsername(), demoMode, authService.getCurrentUserId());
        controller = new AdminDashboardController(
            dashboardService,
            view,
            () => {
                void authService.logout().finally(() => {
                    showLogin('Sesi telah berakhir. Silakan masuk kembali.');
                });
            }
        );
        view.renderShell();
        window.scrollTo(0, 0);
        window.addEventListener('online', () => void controller.refresh(), { once: true });
        void controller.refresh();
    };

    const restored = await authService.restoreSession();
    if (restored.ok) {
        mountDashboard();
        return;
    }
    const error = restored.error.code === 'access_denied'
        ? restored.error.message
        : '';
    showLogin(error);
}

void start();
