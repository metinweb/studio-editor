import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'

async function listFiles(directory, prefix = '') {
  const files = []
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return files
    throw error
  }
  for (const entry of entries) {
    const name = `${prefix}${entry.name}`
    if (entry.isDirectory())
      files.push(...(await listFiles(path.join(directory, entry.name), `${name}/`)))
    else files.push(name)
  }
  return files
}

/** Files the entry chunks load statically: the application shell. */
function shellFiles(bundle) {
  const shell = new Set()
  const visit = (name) => {
    if (shell.has(name)) return
    shell.add(name)
    const chunk = bundle[name]
    if (chunk?.type !== 'chunk') return
    for (const imported of chunk.imports || []) visit(imported)
    for (const css of chunk.viteMetadata?.importedCss || []) shell.add(css)
    for (const asset of chunk.viteMetadata?.importedAssets || []) shell.add(asset)
  }
  for (const file of Object.values(bundle))
    if (file.type === 'chunk' && file.isEntry) visit(file.fileName)
  return shell
}

/**
 * Emits sw.js for the standalone workspace. The statically imported shell and small public
 * files are precached; dynamically imported features (MathJax, Mermaid, CodeMirror…) and
 * public files over `lazyBytes` are fetched in the background after installation.
 * The version changes whenever an emitted or public file changes.
 */
export function studioServiceWorker({
  template = 'src/pwa/service-worker.js',
  publicDir = 'public',
  lazyBytes = 400 * 1024,
} = {}) {
  return {
    name: 'studio-service-worker',
    apply: 'build',
    async generateBundle(_, bundle) {
      const precache = ['index.html']
      const lazy = []
      const shell = shellFiles(bundle)
      const hash = createHash('sha256')
      for (const file of Object.values(bundle).sort((a, b) =>
        a.fileName.localeCompare(b.fileName),
      )) {
        if (file.fileName === 'index.html' || file.fileName.endsWith('.map')) continue
        const size =
          file.type === 'chunk' ? Buffer.byteLength(file.code) : Buffer.byteLength(file.source)
        ;(shell.has(file.fileName) ? precache : lazy).push(file.fileName)
        hash.update(`${file.fileName}:${size}\n`)
      }
      for (const name of (await listFiles(publicDir)).sort()) {
        const bytes = await readFile(path.join(publicDir, name))
        ;(bytes.length > lazyBytes ? lazy : precache).push(name)
        hash.update(name).update(bytes)
      }
      const source = (await readFile(template, 'utf8'))
        .replace("'__STUDIO_SW_VERSION__'", JSON.stringify(hash.digest('hex').slice(0, 16)))
        .replace('__STUDIO_SW_FILES__', JSON.stringify({ precache, lazy }))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}
