import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Determinar la URL de API según el entorno
  const apiUrl = env.NODE_ENV === 'production'
    ? env.VITE_API_URL || 'https://app.hollytrack.com'
    : env.VITE_API_URL || 'http://localhost:3002'

  const port = parseInt(env.VITE_PORT || '5173')

  return {
    plugins: [react()],
    server: {
      port: port,
      strictPort: false,
      host: true,
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path
        }
      }
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV || 'development'),
      'process.env.VITE_API_URL': JSON.stringify(apiUrl)
    }
  }
})
