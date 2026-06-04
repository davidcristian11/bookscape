import fs from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const https =
    env.VITE_HTTPS_KEY && env.VITE_HTTPS_CERT
      ? {
          key: fs.readFileSync(env.VITE_HTTPS_KEY),
          cert: fs.readFileSync(env.VITE_HTTPS_CERT),
        }
      : undefined

  return {
    plugins: [react()],
    server: {
      https,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      exclude: ['node_modules', 'tests/**'],
      setupFiles: './src/test/setup.js',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/components/**/*.{js,jsx}', 'src/App.jsx'],
      },
    },
  }
})
