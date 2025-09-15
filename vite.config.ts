import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.VITE_PORT || '5173'), // PUERTO DEFINITIVO: 5173
    strictPort: false, // Permite usar otro puerto si está ocupado
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3002', // API en puerto 3002
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path // Mantener la ruta /api
      }
    }
  }
})
