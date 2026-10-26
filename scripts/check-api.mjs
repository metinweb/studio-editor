// Fails when the runtime package surface and the hand-written declarations drift apart.
// The sources are Prettier-formatted, so top-level members are found by indentation.
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (file) => readFile(path.join(root, file), 'utf8')
const problems = []

function block(source, start, file, close = '\n}') {
  const begin = source.indexOf(start)
  if (begin < 0) throw new Error(`${file}: "${start}" not found`)
  const end = source.indexOf(close, begin)
  return source.slice(begin + start.length, end)
}
const members = (text, pattern) =>
  new Set(
    text
      .split('\n')
      .map((line) => pattern.exec(line)?.[1])
      .filter(Boolean),
  )
function compare(label, runtime, declared, { optionalDeclared = () => false } = {}) {
  for (const name of runtime)
    if (!declared.has(name)) problems.push(`${label}: "${name}" exists at runtime but is not typed`)
  for (const name of declared)
    if (!runtime.has(name) && !optionalDeclared(name))
      problems.push(`${label}: "${name}" is typed but not provided at runtime`)
}
function runtimeExports(source) {
  const names = new Set()
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g))
    for (const part of match[1].split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .at(-1)
      if (name) names.add(name)
    }
  for (const match of source.matchAll(
    /export\s+(?:async\s+)?(?:const|function|class|let)\s+(\w+)/g,
  ))
    names.add(match[1])
  return names
}
function declaredValues(source) {
  return new Set(
    [...source.matchAll(/^export\s+(?:declare\s+)?(?:const|function|class|let)\s+(\w+)/gm)].map(
      (match) => match[1],
    ),
  )
}

const types = await read('packages/editor/index.d.ts')
compare(
  'src/library/index.js exports',
  runtimeExports(await read('src/library/index.js')),
  declaredValues(types),
)

const component = await read('src/library/StudioEditor.vue')
compare(
  'StudioEditorApi',
  members(block(component, 'const api = {', 'StudioEditor.vue'), /^ {2}([A-Za-z_$][\w$]*)\s*[:,(]/),
  members(block(types, 'export interface StudioEditorApi {', 'index.d.ts'), /^ {2}(\w+)\??\s*[(:]/),
)
const props = members(
  block(component, 'const props = defineProps({', 'StudioEditor.vue'),
  /^ {2}([A-Za-z_$][\w$]*)\s*[:,]/,
)
const declaredProps = members(
  block(types, 'export interface StudioEditorProps {', 'index.d.ts'),
  /^ {2}(\w+)\??\s*:/,
)
compare('StudioEditorProps', props, new Set([...declaredProps].filter((n) => !/^on[A-Z]/.test(n))))

const mount = await read('src/library/mount.js')
const configurable = new Set(
  [...block(mount, 'const configurable = [', 'mount.js', '\n]').matchAll(/'(\w+)'/g)].map(
    (m) => m[1],
  ),
)
for (const name of configurable)
  if (!props.has(name)) problems.push(`mount.js: "${name}" is not a StudioEditor prop`)

if (problems.length) {
  console.error(`API declaration drift (${problems.length}):\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
console.log('API declarations match runtime exports, component API and props.')
