import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import mkcert from 'vite-plugin-mkcert'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Имя репозитория: приложение разворачивается на
// https://<user>.github.io/Body_Mass_Index_frontend/
const BASE = '/Body_Mass_Index_frontend/'

// https://vite.dev/config/
export default defineConfig({
  base: BASE,
  server: {
    port: 3000,
    strictPort: true,
    // Слушаем все интерфейсы: телефон в локальной сети обращается
    // по IP-адресу ноутбука (HTTPS, сертификат покрывает этот IP).
    host: true,
    // Сервер Node.js (реверс-прокси) работает по HTTPS.
    https: {
      key: fs.readFileSync(path.resolve(__dirname, 'cert.key')),
      cert: fs.readFileSync(path.resolve(__dirname, 'cert.crt')),
    },
    proxy: {
      // Обратный прокси к Go-сервису: снимает ограничение CORS.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Второй маршрут — к объектному хранилищу MinIO (S3).
      '/s3': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/s3/, '/body-mass-index'),
      },
    },
  },
  plugins: [
    react(),
    mkcert(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: 'ИМТ Калькулятор',
        short_name: 'ИМТ',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#eeeeee',
        theme_color: '#e43f44',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'icon-192.png',
            type: 'image/png',
            sizes: '192x192',
          },
          {
            src: 'icon-512.png',
            type: 'image/png',
            sizes: '512x512',
          },
        ],
      },
    }),
  ],
})
