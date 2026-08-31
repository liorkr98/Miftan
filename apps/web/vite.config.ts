import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const shared = path.resolve(__dirname, '../../packages/shared/src');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@miftan/shared': path.join(shared, 'index.ts'),
      '@miftan/fixtures': path.resolve(__dirname, '../../packages/fixtures/src/index.ts'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    /* The shared package lives outside this app's root, so Vite needs
       explicit permission to serve from it. */
    fs: { allow: [path.resolve(__dirname, '../..')] },

    /* The API is proxied under /api rather than called on its own origin.
       The refresh cookie is sameSite=lax, and localhost:5178 → 127.0.0.1:4000
       is cross-site, so the browser would refuse to send it and every reload
       would look like a signed-out session. Proxying makes the app and the API
       same-origin in development, which is also how they will be deployed. */
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
