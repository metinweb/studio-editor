import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { studioServiceWorker } from '../service-worker-plugin.mjs'

async function emit(bundle, publicDir) {
  const plugin = studioServiceWorker({ publicDir, lazyBytes: 100 })
  let source
  await plugin.generateBundle.call({ emitFile: (file) => (source = file.source) }, {}, bundle)
  const files = JSON.parse(source.match(/const \{ precache, lazy \} = (\{.*?\})\n/s)[1])
  return { source, files, version: source.match(/const VERSION = "(\w+)"/)[1] }
}

test('the static shell is precached, dynamic features are lazy and the version tracks changes', async () => {
  const publicDir = await mkdtemp(path.join(tmpdir(), 'studio-sw-'))
  try {
    await mkdir(path.join(publicDir, 'icons'))
    await writeFile(path.join(publicDir, 'icons/icon.svg'), '<svg/>')
    const bundle = {
      'index.html': { type: 'asset', fileName: 'index.html', source: '<html>' },
      'assets/index-a.js': {
        type: 'chunk',
        fileName: 'assets/index-a.js',
        code: 'x'.repeat(50),
        isEntry: true,
        imports: ['assets/shared-c.js'],
        viteMetadata: { importedCss: new Set(['assets/index-a.css']), importedAssets: new Set() },
      },
      'assets/shared-c.js': {
        type: 'chunk',
        fileName: 'assets/shared-c.js',
        code: 'x',
        imports: [],
      },
      'assets/index-a.css': { type: 'asset', fileName: 'assets/index-a.css', source: 'a{}' },
      'assets/feature-b.js': {
        type: 'chunk',
        fileName: 'assets/feature-b.js',
        code: 'x',
        isDynamicEntry: true,
        imports: ['assets/shared-c.js'],
      },
      'assets/index-a.js.map': { type: 'asset', fileName: 'assets/index-a.js.map', source: '{}' },
    }
    const first = await emit(bundle, publicDir)
    assert.deepEqual(first.files.precache, [
      'index.html',
      'assets/index-a.css',
      'assets/index-a.js',
      'assets/shared-c.js',
      'icons/icon.svg',
    ])
    assert.deepEqual(first.files.lazy, ['assets/feature-b.js'], 'dynamic imports are lazy')
    assert.doesNotMatch(first.source, /__STUDIO_SW_/)
    assert.equal((await emit(bundle, publicDir)).version, first.version, 'deterministic')
    await writeFile(path.join(publicDir, 'icons/icon.svg'), '<svg viewBox="0 0 1 1"/>')
    assert.notEqual((await emit(bundle, publicDir)).version, first.version)
  } finally {
    await rm(publicDir, { recursive: true, force: true })
  }
})
