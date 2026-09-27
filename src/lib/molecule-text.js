import { Molecule } from 'openchemlib'
import { elements, validMolecule } from './science.js'
import { bondLength } from './molecule-layout.js'

function checkSize(mol) {
  if (!mol.getAllAtoms() || mol.getAllAtoms() > 100 || mol.getAllBonds() > 150)
    throw new Error('molecule-limit')
}
function toGraph(mol, skeletal = true) {
  checkSize(mol)
  mol.inventCoordinates({ keepHydrogens: true, skipDefaultTemplates: true, seed: 42 })
  const atoms = Array.from({ length: mol.getAllAtoms() }, (_, i) => ({
    element: mol.getAtomLabel(i),
    x: mol.getAtomX(i),
    y: mol.getAtomY(i),
  }))
  const xs = atoms.map((a) => a.x),
    ys = atoms.map((a) => a.y)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const scale = Math.min(
    bondLength,
    480 / (Math.max(...xs) - Math.min(...xs) || 1),
    260 / (Math.max(...ys) - Math.min(...ys) || 1),
  )
  for (const a of atoms) {
    a.x = 300 + (a.x - cx) * scale
    a.y = 180 + (a.y - cy) * scale
  }
  const bonds = Array.from({ length: mol.getAllBonds() }, (_, i) => ({
    a: mol.getBondAtom(0, i),
    b: mol.getBondAtom(1, i),
    order: mol.getBondOrder(i),
  }))
  const graph = { atoms, bonds, skeletal }
  if (!validMolecule(graph)) throw new Error('unsupported-structure')
  return graph
}
export function moleculeFromSmiles(text) {
  if (!text.trim() || text.length > 1000) throw new Error('text-limit')
  if (/\s/.test(text.trim())) throw new Error('invalid-structure')
  // The editor cannot depict these properties yet. Never silently discard them.
  if (/[@\\/]|\[[^\]]*:\d/.test(text)) throw new Error('unsupported-structure')
  let mol
  try {
    mol = Molecule.fromSmiles(text, { noCoordinates: true, smartsMode: 'smiles', noCactvs: true })
  } catch {
    throw new Error('invalid-structure')
  }
  checkSize(mol)
  mol.ensureHelperArrays(Molecule.cHelperNeighbours)
  for (let i = 0; i < mol.getAllAtoms(); i++) {
    if (
      !elements.includes(mol.getAtomLabel(i)) ||
      mol.getAtomCharge(i) ||
      mol.getAtomMass(i) ||
      mol.getAtomRadical(i) ||
      mol.getAtomAbnormalValence(i) >= 0
    )
      throw new Error('unsupported-structure')
  }
  try {
    mol.validate()
  } catch {
    throw new Error('invalid-structure')
  }
  // Carbon-bound hydrogens remain implicit. Show heteroatom and isolated-atom
  // hydrogens as real editable atoms, avoiding stale derived hydrogen labels.
  for (let i = mol.getAtoms() - 1; i >= 0; i--)
    if (mol.getAtomicNo(i) !== 6 || mol.getConnAtoms(i) === 0) mol.addImplicitHydrogens(i)
  return toGraph(mol)
}
export function tidyMolecule(graph) {
  if (!validMolecule(graph)) throw new Error('invalid-structure')
  const mol = new Molecule(graph.atoms.length, graph.bonds.length)
  const atomicNos = { H: 1, C: 6, N: 7, O: 8, F: 9, P: 15, S: 16, Cl: 17, Br: 35, I: 53 }
  for (const a of graph.atoms) mol.addAtom(atomicNos[a.element])
  for (const b of graph.bonds)
    mol.setBondType(
      mol.addBond(b.a, b.b),
      [0, Molecule.cBondTypeSingle, Molecule.cBondTypeDouble, Molecule.cBondTypeTriple][b.order],
    )
  return toGraph(mol, graph.skeletal)
}
