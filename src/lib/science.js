import { atomColors, atomLabel, moleculeBondLines } from './molecule-layout.js'
export const elements = ['C', 'H', 'O', 'N', 'S', 'P', 'F', 'Cl', 'Br', 'I']

export function validMolecule(value) {
  if (
    !value ||
    (value.skeletal !== undefined && typeof value.skeletal !== 'boolean') ||
    !Array.isArray(value.atoms) ||
    !Array.isArray(value.bonds) ||
    !value.atoms.length ||
    value.atoms.length > 100 ||
    value.bonds.length > 150
  )
    return false
  if (
    !value.atoms.every(
      (a) =>
        a &&
        elements.includes(a.element) &&
        Number.isFinite(a.x) &&
        Number.isFinite(a.y) &&
        a.x >= 20 &&
        a.x <= 580 &&
        a.y >= 20 &&
        a.y <= 340,
    )
  )
    return false
  const pairs = new Set()
  return value.bonds.every((b) => {
    if (
      !b ||
      !Number.isInteger(b.a) ||
      !Number.isInteger(b.b) ||
      b.a < 0 ||
      b.b < 0 ||
      b.a >= value.atoms.length ||
      b.b >= value.atoms.length ||
      b.a === b.b ||
      ![1, 2, 3].includes(b.order)
    )
      return false
    const key = [b.a, b.b].sort((a, b) => a - b).join(':')
    if (pairs.has(key)) return false
    pairs.add(key)
    return true
  })
}

export function readScience(node) {
  if (node?.tagName !== 'IMG') return null
  const kind = node.getAttribute('data-studio-science')
  const source = node.getAttribute('data-studio-source')
  if (!source || source.length > 20000) return null
  if (kind === 'math' || kind === 'chemistry')
    return source.length <= 4000 ? { kind, source } : null
  if (kind === 'molecule') {
    try {
      const graph = JSON.parse(source)
      if (validMolecule(graph)) return { kind, source, graph }
    } catch {
      /* Invalid imported metadata remains an ordinary image. */
    }
  }
  return null
}

export function moleculePreset(name) {
  if (name === 'water')
    return {
      skeletal: true,
      atoms: [
        { element: 'O', x: 300, y: 130 },
        { element: 'H', x: 235, y: 180 },
        { element: 'H', x: 365, y: 180 },
      ],
      bonds: [
        { a: 0, b: 1, order: 1 },
        { a: 0, b: 2, order: 1 },
      ],
    }
  if (name === 'benzene')
    return {
      skeletal: true,
      atoms: Array.from({ length: 6 }, (_, i) => ({
        element: 'C',
        x: 300 + 85 * Math.cos((i * Math.PI) / 3),
        y: 180 + 85 * Math.sin((i * Math.PI) / 3),
      })),
      bonds: Array.from({ length: 6 }, (_, i) => ({ a: i, b: (i + 1) % 6, order: i % 2 ? 1 : 2 })),
    }
  return {
    skeletal: true,
    atoms: [
      { element: 'C', x: 200, y: 190 },
      { element: 'C', x: 270, y: 150 },
      { element: 'O', x: 340, y: 190 },
      { element: 'H', x: 410, y: 150 },
    ],
    bonds: [
      { a: 0, b: 1, order: 1 },
      { a: 1, b: 2, order: 1 },
      { a: 2, b: 3, order: 1 },
    ],
  }
}

export const bondLines = moleculeBondLines

export function moleculeSvg(graph) {
  if (!validMolecule(graph)) throw new Error('Invalid molecule')
  const xs = graph.atoms.map((a) => a.x),
    ys = graph.atoms.map((a) => a.y)
  const x = Math.min(...xs) - 24,
    y = Math.min(...ys) - 24
  const width = Math.max(...xs) - x + 24,
    height = Math.max(...ys) - y + 24
  const lines = graph.bonds
    .flatMap((b) => bondLines(graph, b))
    .map(
      (l) =>
        `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="#172238" stroke-width="2"/>`,
    )
    .join('')
  const atoms = graph.atoms
    .map((a, index) => {
      const label = atomLabel(graph, index)
      return label
        ? `<text x="${a.x}" y="${a.y + 6.5}" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="500" fill="${atomColors[a.element]}">${label}</text>`
        : ''
    })
    .join('')
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}"><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white"/>${lines}${atoms}</svg>`,
    width,
    height,
  }
}

export async function sciencePng({ svg, width, height }) {
  if (
    ![width, height].every((n) => Number.isFinite(n) && n > 0 && n <= 4096) ||
    width * height > 2000000
  )
    throw new Error('Diagram too large')
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(width * 2)
    canvas.height = Math.ceil(height * 2)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return { src: canvas.toDataURL('image/png'), width: Math.ceil(width) }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function applyScience(engine, target, data) {
  if (!engine?.editable || engine.destroyed || (target && !engine.root.contains(target)))
    return false
  const { kind, source, src, width, alt } = data
  const node = engine.doc.createElement('img')
  node.setAttribute('data-studio-science', kind)
  node.setAttribute('data-studio-source', source)
  if (!readScience(node) || !/^data:image\/png;base64,/.test(src)) return false
  node.src = src
  node.alt = alt.slice(0, 500) || source.slice(0, 500)
  node.style.cssText = `width:${Math.min(width, 600)}px;max-width:100%;height:auto;vertical-align:middle`
  engine.transaction((range) => {
    if (target) {
      node.style.cssText = target.style.cssText
      target.replaceWith(node)
      engine.selectImage(node)
    } else engine.insertFragment(node.outerHTML, range)
  }, 'science')
  return true
}
