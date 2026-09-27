import { test } from 'node:test'
import assert from 'node:assert/strict'
import { equationSvg } from '../../src/lib/science-renderer.js'
import { moleculePreset, validMolecule, moleculeSvg } from '../../src/lib/science.js'

test('self-contained SVG includes glyph paths for equations and chemistry arrows', () => {
  for (const [source, kind] of [
    ['\\frac{1}{2} + \\sqrt{x}', 'math'],
    ['\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', 'math'],
    ['HC#CH + 2H2 -> CH3-CH3', 'chemistry'],
    ['NH4+ + OH- <=> NH3 + H2O', 'chemistry'],
  ]) {
    const output = equationSvg(source, kind)
    assert.match(output.svg, /<path/)
    assert.doesNotMatch(output.svg, /<merror|<text|<image|<script|href=/)
    assert.ok(output.width > 20 && output.height > 20)
  }
  assert.throws(() => equationSvg('\\unknowncommand{x}'))
  assert.throws(() => equationSvg('\\href{https://example.com}{x}'))
  assert.throws(() => equationSvg('x'.repeat(4001)))
})

test('molecule import validation rejects invalid geometry, elements, duplicate and dangling bonds', () => {
  for (const name of ['water', 'ethanol', 'benzene']) {
    const graph = moleculePreset(name)
    assert.equal(validMolecule(graph), true)
    assert.match(moleculeSvg(graph).svg, /<line/)
  }
  const valid = moleculePreset('water')
  for (const mutate of [
    (g) => (g.atoms[0].element = '<svg>'),
    (g) => (g.atoms[0].x = Infinity),
    (g) => (g.bonds[0].b = 40),
    (g) => (g.bonds[0].order = 4),
    (g) => g.bonds.push({ ...g.bonds[0] }),
  ]) {
    const graph = structuredClone(valid)
    mutate(graph)
    assert.equal(validMolecule(graph), false)
  }
})
