import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Determine API_KEY from process.env for build time or runtime
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    'global': 'window',
  },
  resolve: {
    alias: {
      // Ensure buffer is polyfilled
      buffer: 'buffer',
    },
  },
});