import { printOptions } from './page-options.js'

const millimetre = 96 / 25.4
const sizes = { A4: [210, 297], Letter: [215.9, 279.4] }

/** Page box in CSS pixels for print settings (size, orientation, margin in mm). */
export function pageBox(options = {}) {
  const value = printOptions(options)
  let [width, height] = sizes[value.size]
  if (value.landscape) [width, height] = [height, width]
  return {
    width: Math.round(width * millimetre),
    height: Math.round(height * millimetre),
    margin: Math.round(value.margin * millimetre),
  }
}

/**
 * Page break offsets (relative to the top of the content area) for top-level blocks.
 * A block that fits on a page is moved whole to the next page; taller blocks split at the
 * page height. `forced` marks explicit page breaks after a block.
 */
export function pageBreaks(blocks, contentHeight) {
  const breaks = []
  if (!(contentHeight > 0)) return breaks
  let pageTop = 0
  for (const block of blocks) {
    if (block.forced) {
      if (block.bottom > pageTop) {
        pageTop = block.bottom
        breaks.push(pageTop)
      }
      continue
    }
    let guard = 0
    while (block.bottom > pageTop + contentHeight && guard++ < 1000) {
      pageTop =
        block.top > pageTop && block.bottom - block.top <= contentHeight
          ? block.top
          : pageTop + contentHeight
      breaks.push(pageTop)
    }
  }
  return breaks
}

/** 1-based page containing an offset. */
export function pageAt(breaks, offset) {
  let page = 1
  for (const position of breaks) if (offset >= position) page++
  return page
}
