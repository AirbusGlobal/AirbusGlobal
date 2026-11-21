import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      // Explicitly permit all host headers (Vite 8's equivalent of allowing 'all' hosts)
      allowedHosts: true as const,
      cors: true,
      // Disable HMR websocket in iframe environment to prevent websocket closed error
      hmr: false,
      watch: null,
    },
    preview: {
      host: '0.0.0.0',
      allowedHosts: true as const,
    },
  };
});
