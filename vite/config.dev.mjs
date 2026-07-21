import { defineConfig } from 'vite';

export default defineConfig({
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
        strictPort: false
    }
});
