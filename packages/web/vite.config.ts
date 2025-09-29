import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // In Docker, environment variables are passed directly via process.env
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }

  // Check if we're running on Windows or if polling is explicitly enabled
  const isWindows = process.platform === 'win32'
  const usePolling = env.VITE_USE_POLLING === 'true' || isWindows

  return {
    plugins: [
      react(),
      // Plugin to replace environment variables in HTML
      {
        name: 'html-env',
        transformIndexHtml: {
          order: 'pre',
          handler: (html) => {
            return html.replace(/%VITE_\w+%/g, (match) => {
              const envKey = match.slice(1, -1) // Remove % symbols
              return env[envKey] || match
            })
          }
        }
      }
    ],
    base: './',
    resolve: {
      dedupe: ['react', 'react-dom'] // Forza la deduplicación
    },
    server: {
      host: env.VITE_HOST || '0.0.0.0',
      port: parseInt(env.VITE_PORT || '5173'),
      // Allow connections from Docker containers
      cors: true,
      // Enable polling for Windows/Docker compatibility
      watch: {
        usePolling: usePolling,
        interval: parseInt(env.VITE_POLL_INTERVAL || '1000'),
      },
      // Ensure HMR works properly in Docker
      hmr: {
        host: env.VITE_HMR_HOST || 'localhost',
        port: parseInt(env.VITE_HMR_PORT || env.VITE_PORT || '5173'),
      },
    },
  }
})