import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages用のベースパス
// 本番: /vibe-hackathon/
// 開発: /
const base = process.env.NODE_ENV === 'production' ? '/vibe-hackathon/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  // 開発時のみバックエンドプロキシを使用（レガシーモード用）
  server: {
    proxy: process.env.VITE_USE_LEGACY_BACKEND === 'true' ? {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        ws: true,
      },
    } : undefined,
  },
})
