import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // API requests go to backend
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
      },
      // NEW: Image/Upload requests ALSO go to backend
      '/uploads': {
        target: 'http://127.0.0.1:3001/uploads', 
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/uploads/, '') // Removes '/uploads' prefix if backend serves static files from root of that folder
      },
      // ALTERNATIVE: Use this if your backend serves files at http://localhost:3001/uploads/filename.jpg
      /* '/uploads': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
      },
      */
    },
  },
})