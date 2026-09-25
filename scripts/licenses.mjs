import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'))
const project = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const inventory = []
const sections = [
  'STUDIO EDITOR — THIRD-PARTY NOTICES',
  `Generated from the installed production dependency tree. Includes peer dependencies. Each component retains its own license. Studio Editor project license: ${project.license}.`,
]
for (const [relative, metadata] of Object.entries(lock.packages).sort()) {
  if (!relative.startsWith('node_modules/') || metadata.dev) continue
  const directory = path.join(root, relative)
  const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter((file) => file.isFile() && /^(licen[sc]e|copying|notice)([._-]|$)/i.test(file.name))
    .map((file) => file.name)
    .sort()
  if (!files.length) throw new Error(`Missing license text: ${pkg.name}`)
  const entry = {
    name: pkg.name,
    version: pkg.version,
    license: pkg.license || metadata.license || 'UNKNOWN',
    licenseFiles: files,
  }
  inventory.push(entry)
  sections.push(
    `\n${'='.repeat(72)}\n${pkg.name}@${pkg.version}\nDeclared license: ${entry.license}`,
  )
  for (const file of files)
    sections.push(`\n--- ${file} ---\n${await readFile(path.join(directory, file), 'utf8')}`)
}
for (const directory of ['dist', 'packages/editor']) {
  await mkdir(path.join(root, directory), { recursive: true })
  await writeFile(path.join(root, directory, 'THIRD_PARTY_NOTICES.txt'), sections.join('\n') + '\n')
  await writeFile(
    path.join(root, directory, 'dependency-inventory.json'),
    JSON.stringify(inventory, null, 2) + '\n',
  )
}
console.log(`License texts collected for ${inventory.length} installed production packages.`)
