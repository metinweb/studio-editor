// Version 1 local operations use UTF-16 offsets, like DOM Range and JS strings.
// These patches are reversible local edits, not a concurrent-editing protocol.
export function diffText(before, after) {
  let from = 0
  const limit = Math.min(before.length, after.length)
  while (from < limit && before.charCodeAt(from) === after.charCodeAt(from)) from++
  let endBefore = before.length,
    endAfter = after.length
  while (
    endBefore > from &&
    endAfter > from &&
    before.charCodeAt(endBefore - 1) === after.charCodeAt(endAfter - 1)
  ) {
    endBefore--
    endAfter--
  }
  return { from, removed: before.slice(from, endBefore), inserted: after.slice(from, endAfter) }
}
export function applyTextStep(text, step, reverse = false) {
  const removed = reverse ? step.inserted : step.removed
  const inserted = reverse ? step.removed : step.inserted
  if (
    !Number.isInteger(step.from) ||
    step.from < 0 ||
    step.from > text.length ||
    text.slice(step.from, step.from + removed.length) !== removed
  )
    throw new Error('İşlem mevcut belgeyle eşleşmiyor.')
  return text.slice(0, step.from) + inserted + text.slice(step.from + removed.length)
}
export function diffSequence(before = [], after = []) {
  let from = 0,
    endBefore = before.length,
    endAfter = after.length
  while (from < Math.min(endBefore, endAfter) && before[from] === after[from]) from++
  while (endBefore > from && endAfter > from && before[endBefore - 1] === after[endAfter - 1]) {
    endBefore--
    endAfter--
  }
  return { from, removed: before.slice(from, endBefore), inserted: after.slice(from, endAfter) }
}
export function applySequenceStep(values = [], step, reverse = false) {
  const removed = reverse ? step.inserted : step.removed
  const inserted = reverse ? step.removed : step.inserted
  if (
    !Number.isInteger(step.from) ||
    step.from < 0 ||
    step.from + removed.length > values.length ||
    removed.some((value, index) => values[step.from + index] !== value)
  )
    throw new Error('Blok kimlikleri işlemle eşleşmiyor.')
  return [...values.slice(0, step.from), ...inserted, ...values.slice(step.from + removed.length)]
}
export function mapOffset(offset, change, affinity = 1) {
  const end = change.from + change.deleted
  if (offset < change.from || (offset === change.from && affinity < 0)) return offset
  if (offset > end) return offset + change.inserted - change.deleted
  return change.from + (affinity < 0 ? 0 : change.inserted)
}
export function selectionMap(before = [], after = []) {
  const next = new Map(after.map((block) => [block.id, block.text]))
  return before.flatMap((block) => {
    if (!next.has(block.id)) return [{ blockId: block.id, deleted: true }]
    const text = next.get(block.id)
    if (text === block.text) return []
    const step = diffText(block.text, text)
    return [
      {
        blockId: block.id,
        from: step.from,
        deleted: step.removed.length,
        inserted: step.inserted.length,
      },
    ]
  })
}
export function mapSelection(position, changes) {
  if (!position) return null
  const mapped = structuredClone(position)
  for (const key of ['startAnchor', 'endAnchor']) {
    const anchor = mapped[key]
    if (!anchor) continue
    const change = changes.find((item) => item.blockId === anchor.id)
    if (!change) continue
    if (change.deleted === true) return null
    anchor.textOffset = mapOffset(anchor.textOffset, change, anchor.affinity ?? 1)
    anchor.mapped = true
  }
  return mapped
}
