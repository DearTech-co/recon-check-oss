import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { CONTENT_SECURITY_POLICY } from './src/csp';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'recon-check-csp',
      apply: 'build',
      transformIndexHtml(html) {
        if (html.includes('Content-Security-Policy')) return html;
        const meta = `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`;
        return html.replace('<head>', `<head>\n    ${meta}`);
      },
    },
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
  },
});
