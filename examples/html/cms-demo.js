import { mountStudioEditor, bindDocumentSession } from './editor/studio-editor.js'
const initial = {
  id: 'article',
  title: 'Welcome article',
  html: '<h1>Your website, your content</h1><p>Edit this article to try autosave. Open version history to preview and restore an earlier draft.</p><h2>A familiar editor in your CMS</h2><p>Use the Insert menu for tables, math, chemistry and sandboxed web pages. Choose View → Content style settings to use your website’s CSS.</p>',
  version: 'v1',
  blockIds: [],
}
const versions = [{ ...initial, createdAt: new Date().toISOString() }]
const clone = (value) => structuredClone(value)
const adapter = {
  async load() {
    return clone(versions.at(-1))
  },
  async save(record, { expectedVersion }) {
    if (expectedVersion !== versions.at(-1).version)
      throw Object.assign(new Error('Version conflict. Local edits are preserved.'), {
        status: 412,
      })
    const saved = {
      ...clone(record),
      version: `v${versions.length + 1}`,
      createdAt: new Date().toISOString(),
    }
    versions.push(saved)
    return clone(saved)
  },
  async listVersions() {
    return versions
      .toReversed()
      .map(({ version, title, createdAt }) => ({ version, title, createdAt }))
  },
  async loadVersion(_id, version) {
    const found = versions.find((item) => item.version === version)
    if (!found) throw new Error('Version not found.')
    return clone(found)
  },
}
const status = document.querySelector('#status'),
  error = document.querySelector('#error')
let binding
const editor = await mountStudioEditor('#article', {
  height: 620,
  bodyClass: 'article',
  contentCss: ['./article-theme.css'],
  onSave: () => save(),
})
binding = await bindDocumentSession(editor, {
  adapter,
  id: 'article',
  delay: 900,
  onChange(state) {
    status.textContent = `${state.status}${state.record ? ` · ${state.record.version}` : ''}`
    error.hidden = !state.error
    error.textContent = state.error?.message || ''
  },
})
editor.setOptions({ documentSession: binding.session })
async function save() {
  try {
    await binding.session.save()
  } catch (failure) {
    error.hidden = false
    error.textContent = failure.message
  }
}
document.querySelector('#save').onclick = save
document.querySelector('#history').onclick = () => editor.openVersionHistory()
document.querySelector('#export').onclick = () => {
  document.querySelector('#html').textContent = editor.getInlineHTML()
  document.querySelector('details').open = true
}
document.querySelector('#features').onchange = (event) =>
  editor.setOptions({
    features:
      event.target.value === 'all'
        ? {}
        : {
            tables: false,
            media: false,
            science: false,
            source: false,
            ai: false,
            language: false,
            pageEmbed: false,
          },
  })
window.addEventListener(
  'pagehide',
  () => {
    binding.dispose()
    editor.destroy()
  },
  { once: true },
)
