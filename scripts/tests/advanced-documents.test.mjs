import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateFormula, cellAddress } from '../../src/lib/table-formulas.js'
import { readCondition, conditionResult } from '../../src/lib/conditional-fields.js'
import {
  parseWritingProfile,
  saveWritingProfiles,
  loadWritingProfiles,
} from '../../src/lib/writing-profiles.js'

test('formula grammar evaluates arithmetic, ranges and aggregates without executing code', () => {
  const values = [
      [10, 20],
      [5, null],
    ],
    read = (r, c) => values[r]?.[c] ?? null
  assert.equal(evaluateFormula('=SUM(A1:B2)*2+ABS(-3)', read), 73)
  assert.equal(evaluateFormula('=AVERAGE(A1:B2)', read), 35 / 3)
  assert.equal(evaluateFormula('=COUNT(A1:B2)', read), 3)
  assert.equal(evaluateFormula('=ROUND(10/3,2)', read), 3.33)
  assert.equal(evaluateFormula('=MAX(A1:B2)-MIN(A1:B2)', read), 15)
  assert.equal(evaluateFormula('=-(2+3)*4', read), -20)
  assert.equal(cellAddress(0, 26), 'AA1')
  for (const source of [
    '=alert(1)',
    '=A1.constructor',
    '=SUM(A1);globalThis.x=1',
    '=1 2',
    '=SUM(',
    '',
  ])
    assert.throws(() => evaluateFormula(source, read), /#FORMULA!/)
  assert.throws(() => evaluateFormula('=1/0', read), /#DIV\/0!/)
  assert.throws(() => evaluateFormula('=A999999', read), /#REF!/)
  assert.throws(() => evaluateFormula('('.repeat(41) + '1' + ')'.repeat(41), read), /#FORMULA!/)
})
test('conditions validate bounded literal branches and match exact values', () => {
  const c = readCondition({
    key: 'Customer.Type',
    operator: 'equals',
    match: 'business',
    yes: '<b>Business</b>',
    no: 'Individual',
  })
  assert.equal(conditionResult(c, 'business'), '<b>Business</b>')
  assert.equal(conditionResult(c, 'Business'), 'Individual')
  assert.equal(conditionResult({ ...c, operator: 'notEmpty' }, '  '), 'Individual')
  assert.equal(readCondition({ ...c, key: 'bad key' }), null)
  assert.equal(readCondition({ ...c, yes: 'x'.repeat(2001) }), null)
  assert.equal(readCondition('invalid JSON'), null)
})
test('writing profile round trip is bounded and storage errors propagate', () => {
  let data
  const storage = {
    getItem: () => data,
    setItem: (_key, value) => {
      data = value
    },
  }
  const profile = parseWritingProfile({
    schemaVersion: 1,
    kind: 'correction',
    name: 'Signature',
    value: { enabled: true, rules: [{ from: ';sig', to: 'Regards' }] },
  })
  saveWritingProfiles(storage, [profile])
  assert.deepEqual(loadWritingProfiles(storage), [profile])
  assert.throws(() => saveWritingProfiles(storage, Array(21).fill(profile)), /20/)
  assert.throws(() => parseWritingProfile({ ...profile, kind: 'other' }), /profil/)
  assert.throws(
    () =>
      saveWritingProfiles(
        {
          setItem: () => {
            throw new Error('Quota')
          },
        },
        [profile],
      ),
    /Quota/,
  )
})
