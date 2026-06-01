import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  envDir: '../../',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    allowedHosts: true,
    // hmr: {
    //   path: '/logs/',
    // },
    proxy: {
      '/api/logs': {
        target: 'http://logs-api:8080',
        rewrite: (path) => path.replace(/^\/api\/logs/, ''),
      },
    },
  },
})
