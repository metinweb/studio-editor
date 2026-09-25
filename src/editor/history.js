import { applyTextStep, diffText, diffSequence, applySequenceStep } from './operations.js'

const snapshotOf = ({ html, selection, blockIds }) => ({ html, selection, blockIds })
const sizeOf = (entry) => JSON.stringify(entry).length * 2

// One current document plus reversible patches, rather than repeated HTML copies.
export class History {
  constructor(snapshot, { maxEntries = 79, maxBytes = 16 * 1024 * 1024 } = {}) {
    this.current = snapshotOf(snapshot)
    this.entries = []
    this.index = 0
    this.bytes = 0
    this.maxEntries = maxEntries
    this.maxBytes = maxBytes
    this.group = null
    this.lastTime = 0
    this.lastSelection = null
  }
  get canUndo() {
    return this.index > 0
  }
  get canRedo() {
    return this.index < this.entries.length
  }
  get stats() {
    return {
      undo: this.index,
      redo: this.entries.length - this.index,
      patchBytes: this.bytes,
      documentBytes: this.current.html.length * 2,
    }
  }
  checkpoint(snapshot) {
    if (this.current.html !== snapshot.html) return
    this.current = snapshotOf(snapshot)
    if (this.index > 0) {
      const entry = this.entries[this.index - 1]
      this.bytes -= sizeOf(entry)
      entry.selectionAfter = snapshot.selection
      this.bytes += sizeOf(entry)
    }
  }
  commit(snapshot, before = this.current, group = null) {
    if (
      snapshot.html === this.current.html &&
      snapshot.blockIds.length === this.current.blockIds.length &&
      snapshot.blockIds.every((id, i) => id === this.current.blockIds[i])
    )
      return null
    const step = diffText(this.current.html, snapshot.html)
    const continuous =
      group &&
      group === this.group &&
      Date.now() - this.lastTime < 750 &&
      JSON.stringify(before.selection) === this.lastSelection &&
      !this.canRedo
    for (const discarded of this.entries.splice(this.index)) this.bytes -= sizeOf(discarded)
    let entry = {
      step,
      selectionBefore: before.selection,
      selectionAfter: snapshot.selection,
      blockStep: diffSequence(this.current.blockIds, snapshot.blockIds),
    }
    if (continuous && this.index > 0) {
      const previous = this.entries[this.index - 1]
      const original = applyTextStep(this.current.html, previous.step, true)
      entry = {
        ...previous,
        step: diffText(original, snapshot.html),
        selectionAfter: snapshot.selection,
        blockStep: diffSequence(
          applySequenceStep(this.current.blockIds, previous.blockStep, true),
          snapshot.blockIds,
        ),
      }
      this.bytes -= sizeOf(previous)
      this.entries[this.index - 1] = entry
    } else {
      this.entries.push(entry)
      this.index++
    }
    this.bytes += sizeOf(entry)
    this.current = snapshotOf(snapshot)
    this.group = group
    this.lastTime = Date.now()
    this.lastSelection = JSON.stringify(snapshot.selection)
    while (
      this.entries.length > 1 &&
      (this.entries.length > this.maxEntries || this.bytes > this.maxBytes)
    ) {
      this.bytes -= sizeOf(this.entries.shift())
      this.index--
    }
    return step
  }
  move(direction) {
    if (direction < 0 ? !this.canUndo : !this.canRedo) return null
    const reverse = direction < 0
    const entry = this.entries[reverse ? this.index - 1 : this.index]
    const html = applyTextStep(this.current.html, entry.step, reverse)
    this.group = null
    this.index += reverse ? -1 : 1
    this.current = {
      html,
      selection: reverse ? entry.selectionBefore : entry.selectionAfter,
      blockIds: applySequenceStep(this.current.blockIds, entry.blockStep, reverse),
    }
    return this.current
  }
}
