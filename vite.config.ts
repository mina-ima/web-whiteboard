import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      // Force all imports to resolve to the locally installed version
      // This is critical to avoid "Yjs was already imported" errors and ensure single instance
      'yjs': path.resolve(__dirname, './node_modules/yjs'),
      'y-webrtc': path.resolve(__dirname, './node_modules/y-webrtc'),
      'y-protocols': path.resolve(__dirname, './node_modules/y-protocols'),
    },
    dedupe: ['yjs', 'y-webrtc', 'y-protocols'],
  },
  optimizeDeps: {
    include: ['buffer', 'simple-peer', 'yjs', 'y-webrtc'],
  }
});