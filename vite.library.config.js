import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { scopeLibraryCss } from './scripts/scope-library-css.mjs'

export default defineConfig({
  plugins: [vue()],
  publicDir: false,
  css: { postcss: { plugins: [scopeLibraryCss()] } },
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
