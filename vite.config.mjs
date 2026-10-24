import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: '/smartcubeanalyzer/',
    plugins: [
        // Shared .tsx helpers also run in the chart worker, without React Refresh's window.
        react({ exclude: /[/\\]Helpers[/\\]/ }),
        {
            name: 'development-csp',
            apply: 'serve',
            // React Refresh injects an inline preamble; keep the strict policy in production.
            transformIndexHtml: html => html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*\/>/, ''),
        },
    ],
    server: { host: '127.0.0.1', port: 3000 },
    preview: { host: '127.0.0.1' },
    build: { outDir: 'build', target: 'es2015' },
    worker: { format: 'es' },
});
