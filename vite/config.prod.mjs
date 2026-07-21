import { defineConfig } from 'vite';
import { rmSync } from 'node:fs';
import { globSync } from 'node:fs';

// Buang folder .claude-flow (log daemon ruflo) yang bisa mencemari publicDir
// agar tidak ikut ter-copy ke dist produksi.
const stripDaemonLogs = () => {
    return {
        name: 'strip-daemon-logs',
        closeBundle() {
            try {
                for (const dir of globSync('dist/**/.claude-flow', { cwd: process.cwd() })) {
                    rmSync(dir, { recursive: true, force: true });
                }
            } catch {
                // globSync tidak tersedia pada Node lama; abaikan.
            }
        }
    };
};

const phasermsg = () => {
    return {
        name: 'phasermsg',
        buildStart() {
            process.stdout.write(`Building for production...\n`);
        },
        buildEnd() {
            const line = "---------------------------------------------------------";
            const msg = `❤️❤️❤️ Tell us about your game! - games@phaser.io ❤️❤️❤️`;
            process.stdout.write(`${line}\n${msg}\n${line}\n`);
            
            process.stdout.write(`✨ Done ✨\n`);
        }
    }
}   

export default defineConfig({
    base: './',
    logLevel: 'warning',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                passes: 2
            },
            mangle: true,
            format: {
                comments: false
            }
        }
    },
    server: {
        port: 8080
    },
    plugins: [
        phasermsg(),
        stripDaemonLogs()
    ]
});
