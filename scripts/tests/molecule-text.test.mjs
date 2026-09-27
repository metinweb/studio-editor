import test from 'node:test'
import assert from 'node:assert/strict'
import { moleculeFromSmiles, tidyMolecule } from '../../src/lib/molecule-text.js'
import { commonMolecules, resolveMoleculeText } from '../../src/lib/molecule-catalog.js'
import { validMolecule, moleculePreset } from '../../src/lib/science.js'
import { movableAtoms, translateAtoms } from '../../src/lib/molecule-layout.js'

const distances = (graph) =>
  graph.atoms.flatMap((a, i) =>
    graph.atoms.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y)),
  )
function sameDistances(a, b) {
  const before = distances(a),
    after = distances(b)
  before.forEach((d, i) => assert.ok(Math.abs(d - after[i]) < 1e-8))
}
test('cyclic atoms move their connected structure rigidly with boundary clamping, while chains stay editable', () => {
  const ring = moleculePreset('benzene')
  ring.atoms.push({ element: 'O', x: 440, y: 180 }, { element: 'C', x: 100, y: 100 })
  ring.bonds.push({ a: 0, b: 6, order: 1 })
  const before = structuredClone(ring)
  assert.deepEqual(movableAtoms(ring, 6), [6])
  assert.equal(movableAtoms(ring, 0).length, 7)
  for (const [dx, dy] of [
    [30, 20],
    [1000, -1000],
    [-1000, 1000],
  ]) {
    translateAtoms(ring, movableAtoms(ring, 0), dx, dy)
    sameDistances({ atoms: before.atoms.slice(0, 7) }, { atoms: ring.atoms.slice(0, 7) })
    assert.deepEqual(ring.atoms[7], before.atoms[7])
    assert.ok(validMolecule(ring))
  }
  ring.bonds.splice(0, 1)
  assert.deepEqual(movableAtoms(ring, 0), [0])
})
test('fused rings receive the same rigid protection without saved ring metadata', () => {
  const graph = moleculeFromSmiles('c1ccc2ccccc2c1')
  assert.equal(movableAtoms(graph, 0).length, 10)
  const before = structuredClone(graph)
  translateAtoms(graph, movableAtoms(graph, 0), 200, 200)
  sameDistances(before, graph)
})
test('formula resolution requires an explicit common-structure choice and preserves SMILES case', () => {
  assert.deepEqual(
    resolveMoleculeText('C₂H₆O').choices.map((c) => c.smiles),
    ['CCO', 'COC'],
  )
  assert.equal(resolveMoleculeText('CH₃CH₂OH').smiles, 'CCO')
  assert.equal(resolveMoleculeText('c1ccccc1').smiles, 'c1ccccc1')
  assert.equal(resolveMoleculeText('C1CCCCC1').smiles, 'C1CCCCC1')
  assert.equal(resolveMoleculeText('CO', 'smiles').smiles, 'CO')
  assert.throws(() => resolveMoleculeText('CO'), /formula-needs-structure/)
  assert.throws(() => resolveMoleculeText('C5H10'), /formula-needs-structure/)
  assert.throws(() => resolveMoleculeText(''), /text-limit/)
  assert.throws(() => resolveMoleculeText('C'.repeat(1001)), /text-limit/)
})
test('common structures, branches and aromatic SMILES produce valid editable graphs with heteroatom hydrogens', () => {
  for (const item of commonMolecules)
    assert.ok(validMolecule(moleculeFromSmiles(item.smiles)), item.name)
  assert.equal(moleculeFromSmiles('CCO').atoms.filter((a) => a.element === 'H').length, 1)
  assert.equal(moleculeFromSmiles('COC').atoms.filter((a) => a.element === 'H').length, 0)
  const benzene = moleculeFromSmiles('c1ccccc1')
  assert.equal(benzene.bonds.filter((b) => b.order === 2).length, 3)
  benzene.bonds.forEach((b) =>
    assert.ok(
      Math.abs(
        Math.hypot(
          benzene.atoms[b.a].x - benzene.atoms[b.b].x,
          benzene.atoms[b.a].y - benzene.atoms[b.b].y,
        ) - 54,
      ) < 1e-8,
    ),
  )
  assert.ok(validMolecule(moleculeFromSmiles('CC(=O)Oc1ccccc1C(=O)O')))
  assert.ok(validMolecule(moleculeFromSmiles('c1cc[nH]c1')))
})
test('unsupported chemistry, invalid valence and excessive sizes are rejected rather than silently changed', () => {
  for (const text of ['[Na+]', '[NH4+]', '[13CH4]', 'C[C@H](O)F', 'C/C=C/C', '[CH3]', '[CH3:1]'])
    assert.throws(() => moleculeFromSmiles(text), /unsupported-structure/, text)
  for (const text of ['C1CC', 'C(C)(C)(C)(C)C', 'not a molecule', 'CCO ignored text'])
    assert.throws(() => moleculeFromSmiles(text), /invalid-structure/, text)
  assert.throws(() => moleculeFromSmiles('C'.repeat(101)), /molecule-limit/)
})
test('tidying distorted legacy drawings restores ring geometry and preserves atoms and bond orders', () => {
  const distorted = moleculePreset('benzene')
  distorted.atoms[0].x -= 50
  distorted.atoms[1].y += 80
  const fixed = tidyMolecule(distorted)
  assert.equal(fixed.atoms.length, 6)
  assert.equal(fixed.bonds.length, 6)
  assert.equal(fixed.bonds.filter((b) => b.order === 2).length, 3)
  assert.ok(validMolecule(fixed))
  fixed.bonds.forEach((b) =>
    assert.ok(
      Math.abs(
        Math.hypot(
          fixed.atoms[b.a].x - fixed.atoms[b.b].x,
          fixed.atoms[b.a].y - fixed.atoms[b.b].y,
        ) - 54,
      ) < 1e-8,
    ),
  )
})
