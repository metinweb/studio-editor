const maxText = 20000
export function validateAssistanceResult(result, kind, text) {
  if (kind === 'ai') {
    if (typeof result?.text !== 'string' || !result.text.trim() || result.text.length > 100000)
      throw new Error('Invalid AI response.')
    return { text: result.text }
  }
  if (!Array.isArray(result?.issues) || result.issues.length > 200)
    throw new Error('Invalid language-check response.')
  return {
    issues: result.issues.map((item) => {
      if (
        !Number.isInteger(item.offset) ||
        !Number.isInteger(item.length) ||
        item.offset < 0 ||
        item.length < 1 ||
        item.offset + item.length > text.length ||
        typeof item.message !== 'string' ||
        item.message.length > 2000 ||
        !Array.isArray(item.replacements) ||
        item.replacements.length > 10 ||
        item.replacements.some((s) => typeof s !== 'string' || s.length > 4000)
      )
        throw new Error('Invalid language-check issue.')
      return {
        offset: item.offset,
        length: item.length,
        message: item.message,
        replacements: [...item.replacements],
      }
    }),
  }
}
export function createHttpAssistanceAdapter({
  baseUrl,
  getToken = () => '',
  label = 'Your CMS',
  fetch: request = globalThis.fetch,
}) {
  const url = new URL(baseUrl)
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new TypeError('Invalid assistance API URL.')
  const root = url.href.replace(/\/$/, '')
  async function call(kind, input, { signal }) {
    if (!input.text || input.text.length > maxText)
      throw new Error('Select up to 20,000 characters.')
    const token = await getToken()
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const response = await request(`${root}/${kind}`, {
      method: 'POST',
      credentials: 'same-origin',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(input),
    })
    if (!response.ok) throw new Error(`Assistance service returned HTTP ${response.status}.`)
    const raw = await response.text()
    if (raw.length > 512000) throw new Error('Assistance response is too large.')
    return validateAssistanceResult(JSON.parse(raw), kind, input.text)
  }
  return {
    label,
    generate: (input, context) => call('ai', input, context),
    check: (input, context) => call('language', input, context),
  }
}
export function captureAssistance(engine) {
  engine.restoreSelection()
  const range = engine.range().cloneRange()
  const text = range.toString()
  if (!text.trim() || text.length > maxText)
    throw new Error('Select between 1 and 20,000 characters first.')
  for (const node of engine.root.querySelectorAll(
    '[contenteditable="false"], [data-studio-thread], [data-studio-suggestion], pre, code',
  ))
    if (range.intersectsNode(node))
      throw new Error('Select ordinary text outside protected content.')
  return { text, range, revision: engine.revision }
}
export function replaceAssistance(engine, snapshot, value, issue = null) {
  if (engine.features?.[issue ? 'language' : 'ai'] === false) return false
  if (
    !engine.editable ||
    engine.revision !== snapshot.revision ||
    !engine.root.contains(snapshot.range.commonAncestorContainer) ||
    snapshot.range.toString() !== snapshot.text
  )
    return false
  let range = snapshot.range.cloneRange()
  if (issue) {
    const walker = engine.doc.createTreeWalker(engine.root, 4)
    const points = []
    let offset = 0
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!range.intersectsNode(node)) continue
      const start = node === range.startContainer ? range.startOffset : 0
      const end = node === range.endContainer ? range.endOffset : node.length
      for (const position of [issue.offset, issue.offset + issue.length])
        if (
          position >= offset &&
          position <= offset + end - start &&
          !points[position === issue.offset ? 0 : 1]
        )
          points[position === issue.offset ? 0 : 1] = [node, start + position - offset]
      offset += end - start
    }
    if (!points[0] || !points[1]) return false
    range = engine.doc.createRange()
    range.setStart(...points[0])
    range.setEnd(...points[1])
    if (range.toString() !== snapshot.text.slice(issue.offset, issue.offset + issue.length))
      return false
  }
  engine.transaction(
    () => {
      range.deleteContents()
      const fragment = engine.doc.createDocumentFragment()
      for (const [index, line] of value.split('\n').entries()) {
        if (index) fragment.append(engine.doc.createElement('br'))
        fragment.append(engine.doc.createTextNode(line))
      }
      range.insertNode(fragment)
    },
    issue ? 'languageCorrection' : 'aiRewrite',
  )
  return true
}
