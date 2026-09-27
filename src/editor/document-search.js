import { closestBlock } from './selection.js'

const protectedContent =
  'figure[data-studio-embed],[contenteditable="false"],[data-studio-mention],[data-studio-task-control],[data-studio-field],[data-studio-condition],[data-studio-formula],[data-studio-footnote-ref],[data-studio-toc]'
const word = /[\p{L}\p{N}\p{M}_]/u

// Keep source offsets: case folding and accent removal can change string length.
export function textMatches(text, query, options = {}) {
  if (!query || query.length > 2000) return []
  const locale = options.locale === 'tr' ? 'tr' : 'en'
  const fold = (s) => {
    if (!options.sensitive) s = s.toLocaleLowerCase(locale)
    return options.ignoreAccents ? s.normalize('NFD').replace(/\p{M}/gu, '') : s
  }
  const target = [],
    starts = [],
    ends = []
  for (const { segment, index } of new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(
    text,
  )) {
    const value = fold(segment)
    target.push(value)
    for (let i = 0; i < value.length; i++) {
      starts.push(index)
      ends.push(index + segment.length)
    }
  }
  const haystack = target.join(''),
    needle = fold(query),
    result = []
  if (!needle) return result
  for (
    let at = haystack.indexOf(needle);
    at !== -1;
    at = haystack.indexOf(needle, at + needle.length)
  ) {
    const start = starts[at],
      end = ends[at + needle.length - 1]
    // Never match just half of a folded grapheme.
    if (starts[at - 1] === start || ends[at + needle.length] === end) continue
    if (
      options.wholeWord &&
      (word.test([...text.slice(Math.max(0, start - 2), start)].at(-1) || '') ||
        word.test([...text.slice(end, end + 2)][0] || ''))
    )
      continue
    result.push({ start, end })
    if (result.length >= 10000) break
  }
  return result
}

export function documentMatches(root, query, options = {}) {
  if (!query) return []
  const doc = root.ownerDocument,
    walker = doc.createTreeWalker(root, 5),
    groups = []
  let group = null
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === 1) {
      if (node.matches(protectedContent) || node.tagName === 'BR') group = null
      continue
    }
    const protectedParent = node.parentElement.closest(protectedContent)
    if (protectedParent && protectedParent !== root) {
      group = null
      continue
    }
    const block = closestBlock(root, node)
    if (!group || group.block !== block) {
      group = { block, text: '', nodes: [] }
      groups.push(group)
    }
    group.nodes.push({ node, offset: group.text.length })
    group.text += node.data
  }
  const result = []
  for (const group of groups) {
    for (const match of textMatches(group.text, query, options)) {
      const first = group.nodes.find((n) => n.offset + n.node.length > match.start)
      const last = group.nodes.find((n) => n.offset + n.node.length >= match.end)
      const range = doc.createRange()
      range.setStart(first.node, match.start - first.offset)
      range.setEnd(last.node, match.end - last.offset)
      result.push(range)
      if (result.length >= 10000) return result
    }
  }
  return result
}
