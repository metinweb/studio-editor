import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { scopeLibraryCss } from './scripts/scope-library-css.mjs'

// A self-hostable ES module with Vue and Pinia included: no import map or bundler needed.
export default defineConfig({
  plugins: [vue()],
  publicDir: false,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  css: { postcss: { plugins: [scopeLibraryCss()] } },
  build: {
    outDir: 'packages/editor/dist/browser',
    lib: {
      entry: 'src/library/index.js',
      formats: ['es'],
      fileName: 'studio-editor',
      cssFileName: 'studio-editor',
    },
  },
})
