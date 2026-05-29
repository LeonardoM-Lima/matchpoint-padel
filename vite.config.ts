import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'EvoPadel',
        short_name: 'EvoPadel',
        description: 'Ranking da suas partidas de padel',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        background_color: '#0A1628',
        theme_color: '#00C980',
        orientation: 'portrait',
        icons: [
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        importScripts: ['/push-sw.js'],
        navigateFallback: '/',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
