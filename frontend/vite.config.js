import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Enables @/... imports resolving to ./src/...
      // e.g. @/lib/utils, @/components/ui/falling-pattern
      '@': path.resolve(__dirname, './src'),
    },
  },
});
