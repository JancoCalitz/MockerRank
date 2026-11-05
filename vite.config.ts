import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin, type PreviewServer, type ViteDevServer } from 'vite';
import { defineConfig } from 'vitest/config';
import { localAiConfigResponse } from './scripts/local-ai-config.ts';

// Lets the page running on this computer read the AI key from .env. This exists only in the
// local servers. Nothing here reaches the built site, so the key cannot be published with it.
function localAiConfig(): Plugin {
  const serve = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use((request, response, next) => {
      if (!request.url?.split('?')[0]?.endsWith('/__local/ai-config')) return next();
      const env = loadEnv(server.config.mode, server.config.root, 'AI_');
      const { status, body } = localAiConfigResponse(request.headers, env);
      response.statusCode = status;
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Cache-Control', 'no-store');
      response.end(body);
    });
  };
  return { name: 'local-ai-config', configureServer: serve, configurePreviewServer: serve };
}

export default defineConfig({
  // Relative asset paths let the same build run at / locally and /MockerRank/ on GitHub Pages.
  base: './',
  plugins: [react(), tailwindcss(), localAiConfig()],
  test: {
    environment: 'jsdom',
    include: ['{src,scripts}/**/*.test.{ts,tsx}'],
  },
});
