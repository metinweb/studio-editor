// Molecular formulas identify composition, not connectivity. These are common
// examples, not an exhaustive isomer database; the user chooses the structure.
export const commonMolecules = [
  { name: 'Su', formula: 'H2O', smiles: 'O', aliases: ['water', 'su'] },
  { name: 'Amonyak', formula: 'NH3', smiles: 'N', aliases: ['ammonia', 'amonyak'] },
  { name: 'Metan', formula: 'CH4', smiles: 'C', aliases: ['methane', 'metan'] },
  {
    name: 'Karbondioksit',
    formula: 'CO2',
    smiles: 'O=C=O',
    aliases: ['carbon dioxide', 'karbondioksit'],
  },
  { name: 'Oksijen', formula: 'O2', smiles: 'O=O', aliases: ['oxygen', 'oksijen'] },
  { name: 'Azot', formula: 'N2', smiles: 'N#N', aliases: ['nitrogen', 'azot'] },
  { name: 'Hidrojen', formula: 'H2', smiles: '[H][H]', aliases: ['hydrogen', 'hidrojen'] },
  {
    name: 'Etanol',
    formula: 'C2H6O',
    smiles: 'CCO',
    aliases: ['ethanol', 'etanol', 'CH3CH2OH', 'C2H5OH', 'CH3-CH2-OH'],
  },
  {
    name: 'Dimetil eter',
    formula: 'C2H6O',
    smiles: 'COC',
    aliases: ['dimethyl ether', 'dimetil eter', 'CH3OCH3', 'CH3-O-CH3'],
  },
  { name: 'Metanol', formula: 'CH4O', smiles: 'CO', aliases: ['methanol', 'metanol', 'CH3OH'] },
  {
    name: 'Asetik asit',
    formula: 'C2H4O2',
    smiles: 'CC(=O)O',
    aliases: ['acetic acid', 'asetik asit', 'CH3COOH', 'CH3C(=O)OH'],
  },
  {
    name: 'Aseton',
    formula: 'C3H6O',
    smiles: 'CC(=O)C',
    aliases: ['acetone', 'aseton', 'CH3COCH3', 'CH3C(=O)CH3'],
  },
  { name: 'Propanal', formula: 'C3H6O', smiles: 'CCC=O', aliases: ['propanal', 'CH3CH2CHO'] },
  { name: 'Benzen', formula: 'C6H6', smiles: 'c1ccccc1', aliases: ['benzene', 'benzen'] },
  {
    name: 'Siklohekzan',
    formula: 'C6H12',
    smiles: 'C1CCCCC1',
    aliases: ['cyclohexane', 'siklohekzan'],
  },
  { name: '1-Hekzen', formula: 'C6H12', smiles: 'C=CCCCC', aliases: ['1-hexene', '1-hekzen'] },
  {
    name: 'Eten',
    formula: 'C2H4',
    smiles: 'C=C',
    aliases: ['ethene', 'ethylene', 'eten', 'CH2=CH2'],
  },
  {
    name: 'Etin',
    formula: 'C2H2',
    smiles: 'C#C',
    aliases: ['ethyne', 'acetylene', 'etin', 'HC#CH'],
  },
  { name: 'Etan', formula: 'C2H6', smiles: 'CC', aliases: ['ethane', 'etan', 'CH3CH3'] },
  { name: 'Propan', formula: 'C3H8', smiles: 'CCC', aliases: ['propane', 'propan', 'CH3CH2CH3'] },
]
export function resolveMoleculeText(source, mode = 'auto') {
  const text = source.trim().replace(/[₀-₉]/g, (ch) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(ch)))
  if (!text || text.length > 1000) throw new Error('text-limit')
  if (mode === 'smiles') return { smiles: text }
  const compact = text.replace(/\s+/g, '')
  const choices = commonMolecules.filter((item) => item.formula === compact)
  if (choices.length) return { choices }
  const named = commonMolecules.find((item) =>
    item.aliases.some((alias) => alias.toLowerCase() === text.toLowerCase()),
  )
  if (named) return { smiles: named.smiles }
  const tokens = [...compact.matchAll(/([A-Z][a-z]?)(\d*)/g)]
  if (
    tokens.length > 1 &&
    tokens.map((m) => m[0]).join('') === compact &&
    new Set(tokens.map((m) => m[1])).size === tokens.length
  )
    throw new Error('formula-needs-structure')
  return { smiles: text }
}
