import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'MediPlan | Calendario de medicamentos',
        short_name: 'MediPlan',
        description: 'Organiza y registra las tomas de medicamentos de Amelia.',
        theme_color: '#215e59',
        background_color: '#f7faf8',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          {
            src: './icons/mediplan-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: './icons/mediplan-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
})
