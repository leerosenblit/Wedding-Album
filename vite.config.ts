import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'bg.webp'],
      manifest: {
        name: 'האלבום של רוני ולי',
        short_name: 'רוני ולי',
        description: 'שתפו איתנו את הרגעים שלכם מהחתונה',
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        display: 'standalone',
        theme_color: '#D4AF37',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,webp,png,woff2}'],
        // Never cache Firebase / Storage traffic; the gallery must stay live.
        navigateFallbackDenylist: [/^\/__\//],
      },
    }),
  ],
  build: {
    sourcemap: false,
  },
});
