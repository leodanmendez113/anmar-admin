import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'

// Solo en desarrollo: sirve /media/* desde admin/servidor/media-dev (en el VPS lo hace Caddy).
const mediaLocal = {
  name: 'media-local',
  configureServer(server) {
    server.middlewares.use('/media', (req, res, next) => {
      const archivo = join(import.meta.dirname, '../servidor/media-dev', decodeURIComponent(req.url.split('?')[0]))
      if (!archivo.startsWith(join(import.meta.dirname, '../servidor/media-dev')) || !existsSync(archivo)) return next()
      createReadStream(archivo).pipe(res)
    })
  }
}

export default defineConfig({
  base: '/',
  server: {
    port: 5175,
    // En la compu de desarrollo, /api va a la API local (cd ../api && npm start).
    proxy: { '/api': 'http://127.0.0.1:3100' }
  },
  plugins: [
    mediaLocal,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        name: 'Anmar Admin',
        short_name: 'Anmar Admin',
        description: 'Administra videos y precios de Anmar Productions.',
        lang: 'es',
        theme_color: '#0C0C0E',
        background_color: '#0C0C0E',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // La API nunca se guarda en caché: siempre datos frescos.
        navigateFallbackDenylist: [/^\/api/, /^\/media/]
      }
    })
  ]
})
