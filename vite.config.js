import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { darkThemeCss } from './scripts/dark-theme-css.mjs'
import { studioServiceWorker } from './scripts/service-worker-plugin.mjs'

export default defineConfig({
  base: './',
  plugins: [vue(), studioServiceWorker()],
  css: { postcss: { plugins: [darkThemeCss()] } },
  optimizeDeps: { entries: ['index.html'] },
})
