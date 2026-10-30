import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vitest runs separately from the Vite build config so the Laravel plugin is
 * not loaded during unit tests (it expects a running artisan process).
 */
export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
        },
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./resources/js/tests/setup.ts'],
        globals: true,
        include: ['resources/js/**/*.spec.ts'],
    },
});
