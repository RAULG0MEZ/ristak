import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const port = Number.parseInt(env.VITE_PORT || '5173', 10)
  const rawApiUrl = env.VITE_API_URL?.trim() || ''
  const proxyTarget = env.VITE_API_PROXY_TARGET?.trim() || 'http://localhost:3002'
  const proxyPrefix = env.VITE_API_PROXY_PREFIX?.trim() || '/api'
  const shouldProxy = rawApiUrl === ''

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      port,
      strictPort: false,
      host: true,
      proxy: shouldProxy
        ? {
            [proxyPrefix]: {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
              ws: true,
            },
          }
        : undefined,
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV || 'development')
    }
  }
})
