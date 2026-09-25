import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, copyFile, access, readdir } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { unzipSync } from 'fflate'

const root = path.resolve(import.meta.dirname, '..')
const release = path.join(root, 'release')
const manifest = JSON.parse(await readFile(path.join(release, 'manifest.json'), 'utf8'))
assert.equal(manifest.licenseStatus, 'licensed')
assert.equal(manifest.license, 'MIT')
const licenseFile = 'LICENSE'
for (const artifact of manifest.artifacts) {
  const bytes = await readFile(path.join(release, artifact.filename))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), artifact.sha256)
  assert.equal(bytes.length, artifact.bytes)
}
for (const name of [
  'tinymce.min.js',
  'tinymce.d.ts',
  'icons',
  'models',
  'plugins',
  'skins',
  'themes',
  'langs',
  'license.md',
  'notices.txt',
]) {
  await assert.rejects(access(path.join(root, name)), { code: 'ENOENT' })
}
const zip = manifest.artifacts.find((item) => item.filename.endsWith('.zip'))
const web = unzipSync(new Uint8Array(await readFile(path.join(release, zip.filename))))
for (const name of [
  'index.html',
  'THIRD_PARTY_NOTICES.txt',
  'dependency-inventory.json',
  licenseFile,
  'DEPLOYMENT.md',
])
  assert.ok(web[name], `Missing ${name}`)
for (const [name, bytes] of Object.entries(web)) {
  assert.deepEqual(
    Buffer.from(bytes),
    await readFile(path.join(root, 'dist', name)),
    `Stale web asset: ${name}`,
  )
}
assert.ok(
  new TextDecoder().decode(web['index.html']).includes('./assets/'),
  'Web assets must support subdirectories',
)
assert.ok(
  Object.keys(web).every(
    (name) => !/node_modules|tinymce\.(min\.js|d\.ts)|(^|\/)\.env|^src\//i.test(name),
  ),
)
const tgz = manifest.artifacts.find((item) => item.filename.endsWith('.tgz'))
const consumer = path.join(root, '.package-smoke')
await mkdir(consumer, { recursive: true })
await writeFile(
  path.join(consumer, 'package.json'),
  JSON.stringify({ name: 'studio-editor-consumer-check', private: true, type: 'module' }, null, 2),
)
for (const file of ['App.vue', 'main.js', 'index.html', 'types.ts', 'media-adapter.js'])
  await copyFile(path.join(root, 'examples/vue', file), path.join(consumer, file))
const run = (script, args, cwd = root) =>
  execFileSync(process.execPath, [script, ...args], { cwd, stdio: 'inherit' })
if (!process.env.npm_execpath) throw new Error('Run via npm run verify:release')
run(
  process.env.npm_execpath,
  ['install', path.join(release, tgz.filename), '--ignore-scripts', '--no-audit', '--no-fund'],
  consumer,
)
const installed = JSON.parse(
  await readFile(path.join(consumer, 'node_modules/studio-editor/package.json'), 'utf8'),
)
assert.equal(installed.version, manifest.version)
assert.equal(
  installed.private,
  true,
  'npm publication remains disabled until registry ownership is configured',
)
assert.equal(installed.license, manifest.license)
assert.equal(
  await readFile(path.join(root, 'LICENSE'), 'utf8'),
  await readFile(path.join(consumer, 'node_modules/studio-editor/LICENSE'), 'utf8'),
)
for (const file of [
  'index.d.ts',
  'THIRD_PARTY_NOTICES.txt',
  'dependency-inventory.json',
  licenseFile,
  'dist/studio-editor.js',
  'dist/studio-editor.css',
])
  await access(path.join(consumer, 'node_modules/studio-editor', file))
async function compareInstalled(relative = 'dist') {
  const expected = path.join(root, 'packages/editor', relative)
  const actual = path.join(consumer, 'node_modules/studio-editor', relative)
  for (const item of await readdir(expected, { withFileTypes: true })) {
    if (item.isDirectory()) await compareInstalled(path.join(relative, item.name))
    else
      assert.deepEqual(
        await readFile(path.join(actual, item.name)),
        await readFile(path.join(expected, item.name)),
        `Stale npm asset: ${item.name}`,
      )
  }
}
await compareInstalled()
// Import from the installed tarball without window: SSR-safe import, not SSR rendering.
run(
  '--input-type=module',
  [
    '-e',
    "const m = await import('studio-editor'); if (!m.StudioEditor || typeof m.cleanHtml !== 'function') process.exit(1)",
  ],
  consumer,
)
await writeFile(
  path.join(consumer, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        noEmit: true,
        skipLibCheck: false,
      },
      include: ['types.ts'],
    },
    null,
    2,
  ),
)
run(path.join(root, 'node_modules/typescript/bin/tsc'), ['-p', consumer])
await writeFile(
  path.join(consumer, 'vite.config.mjs'),
  `import { defineConfig } from 'vite'\nimport vue from '@vitejs/plugin-vue'\nexport default defineConfig({ root: import.meta.dirname, base: './', plugins: [vue()], build: { outDir: 'dist' } })\n`,
)
run(path.join(root, 'node_modules/vite/bin/vite.js'), [
  'build',
  '--config',
  path.join(consumer, 'vite.config.mjs'),
])
console.log(
  'Verified: artifact checksums, legacy cleanup, static archive, installed npm tarball, TypeScript API, SSR-safe import and consumer production build.',
)
