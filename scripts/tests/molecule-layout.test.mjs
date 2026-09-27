import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addRing,
  atomLabel,
  snapBond,
  moleculeBondLines,
  closestAtom,
  connectAtoms,
  centerMolecule,
} from '../../src/lib/molecule-layout.js'
import { validMolecule, moleculeSvg } from '../../src/lib/science.js'
test('regular rings remain bounded and double bonds face the ring interior', () => {
  const graph = { atoms: [], bonds: [], skeletal: true }
  assert.equal(addRing(graph, { x: 580, y: 20 }, 6, true), true)
  assert.equal(validMolecule(graph), true)
  const bond = graph.bonds[0],
    lines = moleculeBondLines(graph, bond)
  assert.equal(lines.length, 2)
  const cx = graph.atoms.reduce((s, a) => s + a.x, 0) / 6,
    cy = graph.atoms.reduce((s, a) => s + a.y, 0) / 6
  const distance = (l) => Math.hypot((l.x1 + l.x2) / 2 - cx, (l.y1 + l.y2) / 2 - cy)
  assert.ok(distance(lines[1]) < distance(lines[0]))
  assert.equal(atomLabel(graph, 0), '')
  assert.doesNotMatch(moleculeSvg(graph).svg, /<circle|<text/)
  graph.atoms[0].element = 'O'
  assert.match(moleculeSvg(graph).svg, /fill="#d83b46">O<\/text>/)
  centerMolecule(graph)
  assert.equal(validMolecule(graph), true)
})
test('snapping, nearby atom detection and connection avoid duplicate bonds', () => {
  const start = { x: 150, y: 180 },
    end = snapBond(start, { x: 204, y: 178 })
  assert.equal(end.x, 204)
  assert.equal(end.y, 180)
  const graph = {
    atoms: [
      { ...start, element: 'C' },
      { ...end, element: 'C' },
    ],
    bonds: [],
  }
  assert.equal(closestAtom(graph, { x: 201, y: 181 }, 0), 1)
  connectAtoms(graph, 0, 1, 1)
  connectAtoms(graph, 1, 0, 2)
  assert.deepEqual(graph.bonds, [{ a: 0, b: 1, order: 2 }])
  assert.equal(connectAtoms(graph, 0, 0, 1), false)
})
