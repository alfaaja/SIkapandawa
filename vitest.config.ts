import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.test.ts'],
        pool: 'threads',
        fileParallelism: false,
        maxWorkers: 1,
        clearMocks: true,
        restoreMocks: true,
        unstubEnvs: true,
        coverage: {
            provider: 'istanbul',
            reporter: ['text', 'json', 'html'],
            reportsDirectory: './coverage',
            include: [
                'src/admin/**/*.ts',
                'src/shared/auth/**/*.ts',
                'supabase/functions/admin-users/handler.ts',
                'supabase/functions/admin-users/operation.ts',
                'supabase/functions/admin-users/usernameRename.ts',
                'supabase/functions/admin-users/mutationFailure.ts'
            ],
            exclude: [
                'src/**/*.test.ts',
                'src/test/**',
                'src/admin/types.ts',
                // Composition root is exercised by every admin browser flow in e2e/admin.spec.ts.
                'src/admin/main.ts'
            ],
            thresholds: {
                branches: 80,
                functions: 80,
                lines: 80,
                statements: 80
            }
        }
    }
});
