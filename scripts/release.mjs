import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { zipSync } from 'fflate'

const root = path.resolve(import.meta.dirname, '..')
const pkg = JSON.parse(await readFile(path.join(root, 'packages/editor/package.json'), 'utf8'))
if (pkg.license !== 'MIT') throw new Error('Release metadata must declare the MIT license')
const licenseFile = 'LICENSE'
const release = path.join(root, 'release')
await mkdir(release, { recursive: true })
await copyFile(path.join(root, 'docs/DEPLOYMENT.md'), path.join(root, 'dist/DEPLOYMENT.md'))
await copyFile(
  path.join(root, 'packages/editor', licenseFile),
  path.join(root, 'dist', licenseFile),
)
async function collect(directory, prefix = '') {
  const files = {}
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not release assets: ${entry.name}`)
    const name = prefix + entry.name
    if (entry.isDirectory())
      Object.assign(files, await collect(path.join(directory, entry.name), `${name}/`))
    else files[name] = new Uint8Array(await readFile(path.join(directory, entry.name)))
  }
  return files
}
const webFiles = await collect(path.join(root, 'dist'))
const zipName = `studio-editor-${pkg.version}-web.zip`
await writeFile(path.join(release, zipName), zipSync(webFiles, { level: 9 }))
// npm_execpath is supplied by npm run on Windows and Unix; no shell interpolation.
if (!process.env.npm_execpath) throw new Error('Run via npm run package:release')
const output = execFileSync(
  process.execPath,
  [
    process.env.npm_execpath,
    'pack',
    './packages/editor',
    '--pack-destination',
    release,
    '--ignore-scripts',
    '--json',
  ],
  { cwd: root, encoding: 'utf8' },
)
const [packed] = JSON.parse(output)
const manifest = {
  name: pkg.name,
  version: pkg.version,
  license: pkg.license,
  licenseStatus: 'licensed',
  artifacts: [],
}
for (const filename of [zipName, packed.filename]) {
  const bytes = await readFile(path.join(release, filename))
  manifest.artifacts.push({
    filename,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  })
}
await writeFile(path.join(release, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
await writeFile(
  path.join(release, 'SHA256SUMS.txt'),
  manifest.artifacts.map((item) => `${item.sha256}  ${item.filename}`).join('\n') + '\n',
)
console.log(JSON.stringify(manifest, null, 2))
