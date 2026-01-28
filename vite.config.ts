import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Read backend .env file to get the PORT
const backendEnvPath = path.resolve(__dirname, 'backend', '.env');
let backendPort = '3000'; // default fallback

if (fs.existsSync(backendEnvPath)) {
  const backendEnvContent = fs.readFileSync(backendEnvPath, 'utf-8');
  const portMatch = backendEnvContent.match(/PORT=(\d+)/);
  if (portMatch) {
    backendPort = portMatch[1];
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.VITE_BACKEND_URL || `http://127.0.0.1:${backendPort}`;

  return {
    plugins: [react()],
    server: {
      proxy: {
        // API requests go to backend
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        // Image/Upload requests ALSO go to backend
        '/uploads': {
          target: `${backendUrl}/uploads`, 
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/uploads/, '') // Removes '/uploads' prefix if backend serves static files from root of that folder
        },
      },
    },
  }
})