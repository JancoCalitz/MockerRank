import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths let the same build run at / locally and /MockerRank/ on GitHub Pages.
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    include: ['{src,scripts}/**/*.test.{ts,tsx}'],
  },
});
