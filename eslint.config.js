import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import globals from 'globals'

// Correctness rules only. Formatting stays with Prettier; Vue style presets are not enabled
// because the existing templates intentionally use compact attribute layouts.
export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'site-dist/**',
      'release/**',
      'packages/editor/dist/**',
      '.package-smoke/**',
      '.sites-runtime/**',
      'test-results/**',
      'package-test-results/**',
      'graphify-out/**',
      '.publish/**',
      'website/**/*.min.js',
    ],
  },
  js.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
      'no-control-regex': 'off',
      'no-useless-escape': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/no-mutating-props': ['error', { shallowOnly: true }],
    },
  },
  {
    files: [
      'scripts/**',
      'examples/*.mjs',
      'tests/**',
      'packages/tests/**',
      '*.config.js',
      'eslint.config.js',
    ],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['src/lib/image-worker.js', 'src/pwa/**/*.js', 'public/**/*.js'],
    languageOptions: {
      globals: { ...globals.worker, ...globals.serviceworker, __STUDIO_SW_FILES__: 'readonly' },
    },
  },
]
