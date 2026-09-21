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
      workbox: {
        // Um deploy novo troca o hash de todos os chunks. Sem limpar o cache
        // velho e sem assumir o controle na hora, o service worker antigo
        // continua servindo um index que aponta para arquivos que não existem
        // mais — é o "Failed to fetch dynamically imported module".
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'Souza Imobiliária',
        short_name: 'Souza Imob',
        description: 'Vendas, comissões e financeiro da Souza Imobiliária',
        lang: 'pt-BR',
        // As cores da casca de hoje (5.1): o azul e o papel antigos ficaram
        // para trás e pintavam a tela de abertura no celular com outra marca.
        theme_color: '#070B1A',
        background_color: '#070B1A',
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
            name: 'A receber',
            short_name: 'Receber',
            description: 'O que ainda entra, por vencimento',
            url: '/receber',
            icons: [{ src: 'pwa-192.png', sizes: '192x192' }],
          },
          {
            name: 'A pagar',
            short_name: 'Pagar',
            description: 'Comissões liberadas, imposto e despesas',
            url: '/pagar',
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
        },
      },
    },
  },
})
