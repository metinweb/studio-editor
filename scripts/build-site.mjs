import { access, cp, mkdir, rm, writeFile, readFile, copyFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const output = path.resolve(root, 'site-dist')
// Only this fixed, generated directory may be replaced.
if (path.dirname(output) !== root || path.basename(output) !== 'site-dist')
  throw new Error('Invalid site output directory')
await access(path.join(root, 'dist/index.html'))
await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
await cp(path.join(root, 'website'), output, { recursive: true })
await cp(path.join(root, 'dist'), path.join(output, 'demo'), { recursive: true })
const pkg = JSON.parse(await readFile(path.join(root, 'packages/editor/package.json'), 'utf8'))
if (pkg.license !== 'MIT') throw new Error('Site metadata must declare the MIT license')
const licenseFile = 'LICENSE'
await copyFile(
  path.join(root, 'packages/editor', licenseFile),
  path.join(output, 'demo', licenseFile),
)
await writeFile(path.join(output, '.nojekyll'), '')
await copyFile(path.join(root, 'LICENSE'), path.join(output, 'LICENSE'))
console.log('Built landing page and editor demo in site-dist/')
