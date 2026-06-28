import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../backend/daemon/dist',
    emptyOutDir: true, // Xóa thư mục cũ trước khi build mới
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:18900',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://127.0.0.1:18900',
        ws: true
      }
    }
  }
})

