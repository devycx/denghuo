import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

// Cloudflare 官方 Vite 插件：一个 dev server 同时跑前端与 Worker，
// 无需 concurrently / proxy；构建产物为 dist/client + dist/wrangler.json。
export default defineConfig({
  plugins: [react(), cloudflare({ viteEnvironment: { name: 'worker' } })],
  environments: {
    worker: { build: { sourcemap: true } },
  },
});
