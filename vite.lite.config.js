import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { scopeLibraryCss } from './scripts/scope-library-css.mjs'
import { darkThemeCss } from './scripts/dark-theme-css.mjs'

// studio-editor/lite: the same component without MathJax, OpenChemLib, Mammoth and Mermaid.
// Science, Word import and diagrams are disabled by the feature policy; their modules become stubs.
const stub = fileURLToPath(new URL('./src/lib/build/unavailable.js', import.meta.url))
const browser = process.env.STUDIO_LITE_TARGET === 'browser'
export default defineConfig({
  plugins: [vue()],
  publicDir: false,
  resolve: {
    alias: [
      {
        find: /^\.\/build\/flags\.js$/,
        replacement: fileURLToPath(new URL('./src/lib/build/flags.lite.js', import.meta.url)),
      },
      { find: /^(\.\.\/lib|\.)\/science-renderer\.js$/, replacement: stub },
      { find: /^(\.\.\/lib|\.)\/molecule-text\.js$/, replacement: stub },
      { find: /^mammoth\/mammoth\.browser\.js$/, replacement: stub },
      {
        find: /^mermaid$/,
        replacement: fileURLToPath(
          new URL('./src/lib/build/unavailable-mermaid.js', import.meta.url),
        ),
      },
    ],
  },
  define: browser
    ? {
        'process.env.NODE_ENV': JSON.stringify('production'),
        __VUE_OPTIONS_API__: true,
        __VUE_PROD_DEVTOOLS__: false,
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
      }
    : {},
  // Scope first so the dark variants are generated for the final selectors.
  css: { postcss: { plugins: [scopeLibraryCss(), darkThemeCss()] } },
  build: {
    outDir: browser ? 'packages/editor/dist/lite/browser' : 'packages/editor/dist/lite',
    emptyOutDir: true,
    lib: {
      entry: 'src/library/index.js',
      formats: ['es'],
      fileName: 'studio-editor',
      cssFileName: 'studio-editor',
    },
    rollupOptions: browser ? {} : { external: ['vue', 'pinia'] },
  },
})
