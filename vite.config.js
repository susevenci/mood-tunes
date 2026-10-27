import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    host: 'localhost',
    port: 5173,
    open: false,
  },
  optimizeDeps: {
    // face-api 的 ESM 构建已自带 TFJS，交给浏览器按原样加载，避免二次预打包。
    exclude: ['@vladmandic/face-api'],
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
