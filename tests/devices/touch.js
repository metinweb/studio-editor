// Real touches are sent in device coordinates (Android pixels, iOS points). A transparent probe
// receives two taps at known device points; where the page saw them gives the scale and offset
// from page (CSS) coordinates to the device screen, including browser bars.

/** Two device points inside the web content, above any software keyboard. */
export function probePoints({ width, height }) {
  return [
    { x: Math.round(width * 0.35), y: Math.round(height * 0.28) },
    { x: Math.round(width * 0.7), y: Math.round(height * 0.4) },
  ]
}

/** Runs in the page: covers it with a probe that records pointer positions. */
export function installProbe() {
  window.__studioProbe?.remove()
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;inset:0;z-index:2147483647;touch-action:none'
  const touches = []
  // Stopped at the window, so the page never sees probe taps: menus stay open and focus,
  // selection and the software keyboard stay where they are.
  const block = (event) => {
    if (event.target !== probe) return
    if (event.type === 'pointerdown')
      touches.push({ x: event.clientX, y: event.clientY, type: event.pointerType })
    if (event.cancelable) event.preventDefault()
    event.stopImmediatePropagation()
  }
  const types = [
    'pointerdown',
    'pointerup',
    'touchstart',
    'touchend',
    'mousedown',
    'mouseup',
    'click',
  ]
  for (const type of types) window.addEventListener(type, block, { capture: true, passive: false })
  window.__studioProbe = {
    touches,
    remove() {
      for (const type of types) window.removeEventListener(type, block, { capture: true })
      probe.remove()
    },
  }
  document.body.append(probe)
}

/** Runs in the page: returns the recorded touches and removes the probe. */
export function readProbe() {
  const probe = window.__studioProbe
  probe?.remove()
  window.__studioProbe = null
  return probe?.touches || []
}

/** Page-to-device transform from the probe points and the touches the page received. */
export function deviceMapping(points, touches) {
  const axis = (key) => {
    const scale = (points[1][key] - points[0][key]) / (touches[1][key] - touches[0][key])
    return { scale, offset: points[0][key] - touches[0][key] * scale }
  }
  const x = axis('x'),
    y = axis('y')
  return (point) => ({
    x: Math.round(x.offset + point.x * x.scale),
    y: Math.round(y.offset + point.y * y.scale),
  })
}

/**
 * Runs in the page: returns an element's center in page coordinates, scrolling it into view
 * unless `scroll` is false. `editor` looks inside the editing iframe; `name` matches the text or
 * accessible label and `text` a part of the text.
 */
export function elementCenter({ selector, editor, name, text, scroll = true }) {
  const frame = document.querySelector('.studio-editor-frame')
  const root = editor ? frame.contentDocument : document
  const element = [...root.querySelectorAll(selector)].find(
    (node) =>
      node.getClientRects().length &&
      (!text || node.textContent.includes(text)) &&
      (!name ||
        node.getAttribute('aria-label') === name ||
        node.dataset.label === name ||
        node.textContent.trim() === name),
  )
  if (!element) return null
  if (scroll) element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  const rect = element.getBoundingClientRect()
  const origin = editor ? frame.getBoundingClientRect() : { left: 0, top: 0 }
  return { x: origin.left + rect.left + rect.width / 2, y: origin.top + rect.top + rect.height / 2 }
}

/** Runs in the page: selects the first occurrence of `text` inside the editor, ignoring case. */
export function selectEditorText(text) {
  const content = document.querySelector('.studio-editor-frame').contentDocument
  const walker = content.createTreeWalker(content.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const index = walker.currentNode.data.toLowerCase().indexOf(text.toLowerCase())
    if (index < 0) continue
    const range = content.createRange()
    range.setStart(walker.currentNode, index)
    range.setEnd(walker.currentNode, index + text.length)
    const selection = content.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    return true
  }
  return false
}

/** Runs in the page: summary of the editor and layout state used by the device tests. */
export function editorState() {
  const content = document.querySelector('.studio-editor-frame')?.contentDocument
  if (!content?.body) return { focused: false, text: '', bold: [], rules: 0, menu: false }
  return {
    focused: content.hasFocus() && content.activeElement === content.body,
    text: content.body.innerText,
    bold: [...content.querySelectorAll('strong, b')].map((node) => node.textContent),
    rules: content.querySelectorAll('hr').length,
    menu: !!document.querySelector('[role="menu"]'),
    horizontalScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }
}

/** Runs in the page: records key, input and composition events inside the editor. */
export function recordInput() {
  if (window.__studioInput) return
  const content = document.querySelector('.studio-editor-frame').contentDocument
  const log = (window.__studioInput = [])
  const types = ['keydown', 'beforeinput', 'input', 'compositionstart', 'compositionupdate']
  for (const type of [...types, 'compositionend'])
    content.addEventListener(
      type,
      (event) =>
        log.push(
          `${type} ${event.inputType || event.key || ''} ${JSON.stringify(event.data ?? '')}` +
            (event.isComposing ? ' composing' : ''),
        ),
      true,
    )
}

/** Runs in the page: adds a step marker with the HTML of the paragraph being edited. */
export function markInput(step) {
  const content = document.querySelector('.studio-editor-frame').contentDocument
  const paragraph = [...content.querySelectorAll('p')].find((node) =>
    node.textContent.includes('Bir hikâye'),
  )
  window.__studioInput?.push(`--- ${step}: ${paragraph?.innerHTML}`)
}

/** Runs in the page: the recorded events and step markers. */
export function inputLog() {
  return (window.__studioInput || []).join('\n')
}
