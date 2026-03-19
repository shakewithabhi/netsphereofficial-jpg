import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        timeout: 600000,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Remove content-length limit for large uploads
            proxyReq.setHeader('Connection', 'keep-alive');
          });
        },
      },
    },
  },
})
