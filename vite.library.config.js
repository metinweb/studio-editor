import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { scopeLibraryCss } from './scripts/scope-library-css.mjs'
import { darkThemeCss } from './scripts/dark-theme-css.mjs'

export default defineConfig({
  plugins: [vue()],
  publicDir: false,
  // Scope first so the dark variants are generated for the final selectors.
  css: { postcss: { plugins: [scopeLibraryCss(), darkThemeCss()] } },
  build: {
    outDir: 'packages/editor/dist',
    lib: {
      entry: 'src/library/index.js',
      formats: ['es'],
      fileName: 'studio-editor',
      cssFileName: 'studio-editor',
    },
    rollupOptions: { external: ['vue', 'pinia'] },
  },
})
