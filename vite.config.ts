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
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'pwa-maskable-512.png'],
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
        // Souza 4.0 (02/11/2026): o nome e o ícone "Sf" da família Souza (o "Sa" é o Academy).
        name: 'Souza Financeiro',
        short_name: 'Financeiro',
        description: 'Vendas, comissões e financeiro da Souza Imobiliária',
        lang: 'pt-BR',
        // O marinho da moldura: a tela de abertura no celular já nasce na cor da marca.
        theme_color: '#F3F6FB',
        background_color: '#F3F6FB',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          // Maskable: fundo até a borda e o "Sf" dentro da zona segura (o Android recorta).
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
