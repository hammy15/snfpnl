import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // PDF generation - large libraries
          'pdf-jspdf': ['jspdf'],
          'pdf-html2canvas': ['html2canvas'],
          // Maps
          'maps': ['leaflet', 'react-leaflet'],
          // Data fetching
          'query': ['@tanstack/react-query'],
          // Icons
          'icons': ['lucide-react'],
        },
      },
    },
  },
})
