import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Souza Group Finance',
        short_name: 'Souza Finance',
        description: 'Painel financeiro multi-empresa do Souza Group',
        lang: 'pt-BR',
        theme_color: '#FFFFFF',
        background_color: '#F4F6FA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Segurar o ícone do app na home do iPhone/Android mostra estes atalhos.
        shortcuts: [
          {
            name: 'Novo gasto pessoal',
            short_name: 'Novo gasto',
            description: 'Lançar um gasto pessoal em 3 toques',
            url: '/pessoal?novo=gasto',
            icons: [{ src: 'pwa-192.png', sizes: '192x192' }],
          },
          {
            name: 'Pessoal',
            short_name: 'Pessoal',
            description: 'Suas finanças pessoais',
            url: '/pessoal',
            icons: [{ src: 'pwa-192.png', sizes: '192x192' }],
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          charts: ['recharts'],
        },
      },
    },
  },
})
