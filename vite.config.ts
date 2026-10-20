import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The pipeline writes versioned datasets to data/; serve that folder as the static root
// so the app fetches exactly what the pipeline produced.
export default defineConfig({
  plugins: [react()],
  publicDir: 'data',
  base: './',
  build: {
    // MapLibre (~1 MB) and ECharts (~0.5 MB) are large but each is its own lazily loaded
    // chunk; the initial bundle stays small. Warn only above that.
    chunkSizeWarningLimit: 1100,
  },
  test: {
    include: ['pipeline/**/*.test.ts', 'src/**/*.test.ts', 'shared/**/*.test.ts'],
  },
});
