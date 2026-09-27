export const atomColors = {
  C: '#243247',
  H: '#566579',
  O: '#d83b46',
  N: '#316ad5',
  S: '#9a7400',
  P: '#ba601c',
  F: '#25834b',
  Cl: '#25834b',
  Br: '#a54d36',
  I: '#8054a9',
}
export const bondLength = 54
export const cloneMolecule = (graph) => JSON.parse(JSON.stringify(graph))
export function atomLabel(graph, index) {
  const atom = graph.atoms[index]
  return graph.skeletal &&
    atom.element === 'C' &&
    graph.bonds.some((b) => b.a === index || b.b === index)
    ? ''
    : atom.element
}
export function snapBond(start, end, snap = true) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  const theta = snap ? (Math.round(angle / (Math.PI / 6)) * Math.PI) / 6 : angle
  const length = snap
    ? bondLength
    : Math.min(140, Math.max(24, Math.hypot(end.x - start.x, end.y - start.y)))
  return {
    x: Math.max(20, Math.min(580, start.x + length * Math.cos(theta))),
    y: Math.max(20, Math.min(340, start.y + length * Math.sin(theta))),
  }
}
export function closestAtom(graph, point, exclude = -1, radius = 18) {
  let result = -1,
    distance = radius
  graph.atoms.forEach((atom, i) => {
    const d = Math.hypot(atom.x - point.x, atom.y - point.y)
    if (i !== exclude && d < distance) {
      distance = d
      result = i
    }
  })
  return result
}
export function connectAtoms(graph, a, b, order) {
  if (a === b) return false
  const bond = graph.bonds.find(
    (bond) => (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a),
  )
  if (bond) bond.order = order
  else if (graph.bonds.length < 150) graph.bonds.push({ a, b, order })
  else return false
  return true
}
export function addRing(graph, center, count = 6, aromatic = false) {
  if (graph.atoms.length + count > 100 || graph.bonds.length + count > 150) return false
  const radius = bondLength / (2 * Math.sin(Math.PI / count))
  const x = Math.max(24 + radius, Math.min(576 - radius, center.x))
  const y = Math.max(24 + radius, Math.min(336 - radius, center.y))
  const offset = graph.atoms.length
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / count
    graph.atoms.push({
      element: 'C',
      x: x + radius * Math.cos(angle),
      y: y + radius * Math.sin(angle),
    })
    graph.bonds.push({
      a: offset + i,
      b: offset + ((i + 1) % count),
      order: aromatic && i % 2 === 0 ? 2 : 1,
    })
  }
  return true
}
export function centerMolecule(graph) {
  if (!graph.atoms.length) return graph
  const xs = graph.atoms.map((a) => a.x),
    ys = graph.atoms.map((a) => a.y)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const scale = Math.min(
    1,
    480 / (Math.max(...xs) - Math.min(...xs) || 1),
    260 / (Math.max(...ys) - Math.min(...ys) || 1),
  )
  graph.atoms.forEach((a) => {
    a.x = 300 + (a.x - cx) * scale
    a.y = 180 + (a.y - cy) * scale
  })
  return graph
}
// Locate the shortest alternate path so a ring's inner double bond faces its center.
function ringCenter(graph, bond) {
  const queue = [[bond.a]],
    seen = new Set([bond.a])
  while (queue.length) {
    const path = queue.shift(),
      last = path[path.length - 1]
    if (path.length > 12) continue
    for (const other of graph.bonds) {
      if (other === bond) continue
      const next = other.a === last ? other.b : other.b === last ? other.a : -1
      if (next < 0) continue
      if (next === bond.b) {
        const atoms = [...path, next].map((i) => graph.atoms[i])
        return {
          x: atoms.reduce((sum, a) => sum + a.x, 0) / atoms.length,
          y: atoms.reduce((sum, a) => sum + a.y, 0) / atoms.length,
        }
      }
      if (!seen.has(next)) {
        seen.add(next)
        queue.push([...path, next])
      }
    }
  }
  return null
}
export function moleculeBondLines(graph, bond) {
  const a = graph.atoms[bond.a],
    b = graph.atoms[bond.b]
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy) || 1
  const ux = dx / length,
    uy = dy / length
  const center = bond.order === 2 ? ringCenter(graph, bond) : null
  const inner = center ? Math.sign(-uy * (center.x - a.x) + ux * (center.y - a.y)) || 1 : 0
  return Array.from({ length: bond.order }, (_, i) => {
    const offset = center ? i * inner * 6 : (i - (bond.order - 1) / 2) * 5
    const inset = center && i === 1 ? 9 : 0
    const padA = Math.min(length / 3, (atomLabel(graph, bond.a) ? 13 : 0) + inset)
    const padB = Math.min(length / 3, (atomLabel(graph, bond.b) ? 13 : 0) + inset)
    return {
      x1: a.x + ux * padA - uy * offset,
      y1: a.y + uy * padA + ux * offset,
      x2: b.x - ux * padB - uy * offset,
      y2: b.y - uy * padB + ux * offset,
    }
  })
}
