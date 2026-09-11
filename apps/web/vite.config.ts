import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/* import.meta.dirname keeps Vite's native config loader happy; __dirname is
   unsupported there and warns on every build. */
const here = path.dirname(fileURLToPath(import.meta.url));
const shared = path.resolve(here, '../../packages/shared/src');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@miftan/shared': path.join(shared, 'index.ts'),
      '@miftan/fixtures': path.resolve(here, '../../packages/fixtures/src/index.ts'),
      '@': path.resolve(here, './src'),
    },
  },
  server: {
    /**
     * Bind every interface, not just loopback.
     *
     * Vite's default is localhost-only, which means a phone on the same wifi
     * gets "site can't be reached" — and a phone is where half of this product
     * is actually used, so testing on one cannot be a special setup.
     *
     * The proxy below still points at 127.0.0.1 on purpose: that resolves on
     * the machine running Vite, which is where the API is.
     */
    host: true,

    /**
     * Pinned, and strict.
     *
     * The port was previously only 5178 because whatever launched it happened
     * to pass a flag; a bare `npm run dev` got Vite's default 5173. That
     * matters because the API's WEB_ORIGIN, the cookie scope and every document
     * name 5178 — so the app silently half-worked depending on how it was
     * started. `strictPort` makes a clash fail loudly rather than drift to
     * 5179 and break CORS with no message.
     */
    port: 5178,
    strictPort: true,

    /* The shared package lives outside this app's root, so Vite needs
       explicit permission to serve from it. */
    fs: { allow: [path.resolve(here, '../..')] },

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
