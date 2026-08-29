import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const shared = path.resolve(__dirname, '../../packages/shared/src');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@miftach/shared': path.join(shared, 'index.ts'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    /* The shared package lives outside this app's root, so Vite needs
       explicit permission to serve from it. */
    fs: { allow: [path.resolve(__dirname, '../..')] },
  },
});
