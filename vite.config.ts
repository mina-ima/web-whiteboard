import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Determine API_KEY from process.env for build time or runtime
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    'global': 'window',
    // 'process': {}, // REMOVED: This breaks simple-peer in browser
  },
  resolve: {
    alias: {
      // Ensure buffer is polyfilled
      buffer: 'buffer',
    },
    // CRITICAL: Prevent duplicate Yjs instances which breaks synchronization
    dedupe: ['yjs', 'y-webrtc', 'y-protocols'],
  },
  optimizeDeps: {
    include: ['buffer', 'simple-peer', 'yjs', 'y-webrtc'],
  }
});