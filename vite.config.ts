import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The pipeline writes versioned datasets to data/; serve that folder as the static root
// so the app fetches exactly what the pipeline produced.
export default defineConfig({
  plugins: [react()],
  publicDir: 'data',
  base: './',
  test: {
    include: ['pipeline/**/*.test.ts', 'src/**/*.test.ts', 'shared/**/*.test.ts'],
  },
});
