import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const environment = loadEnv(mode, process.cwd());
    const projectUrl = environment.VITE_SUPABASE_URL?.trim();
    return {
        base: './',
        build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        phaser: ['phaser']
                    }
                }
            },
        },
        server: {
            // Gunakan port yang diberikan environment (preview harness); fallback 8080.
            port: Number(process.env.PORT) || 8080,
            strictPort: false,
            // Fixed development-only route; authentication/admin authorization remain remote.
            // Use an already approved loopback origin without changing hosted CORS rules.
            proxy: projectUrl ? {
                '^/__admin_api/admin-users$': {
                    target: new URL(projectUrl).origin,
                    changeOrigin: true,
                    headers: { origin: 'http://127.0.0.1:8081' },
                    rewrite: () => '/functions/v1/admin-users'
                }
            } : {}
        }
    };
});
