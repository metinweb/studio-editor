import { createApp, h, nextTick, reactive } from 'vue'
import { createPinia, disposePinia } from 'pinia'
import StudioEditor from './StudioEditor.vue'

const mounted = new WeakSet()
const configurable = [
  'direction',
  'height',
  'mentions',
  'allowCreateMention',
  'readonly',
  'disabled',
  'placeholder',
  'toolbar',
  'menubar',
  'locale',
  'messages',
  'pasteMode',
  'tablePasteStyle',
  'contentCss',
  'allowContentCss',
  'bodyClass',
  'features',
  'documentSession',
]

/** Enhance one existing textarea. No router, workspace or persistence is installed. */
export async function mountStudioEditor(target, options = {}) {
  if (typeof document === 'undefined') throw new Error('Mount the editor in a browser.')
  const source = typeof target === 'string' ? document.querySelector(target) : target
  if (!(source instanceof HTMLTextAreaElement) || !source.isConnected)
    throw new TypeError('Expected a connected textarea or its selector.')
  if (mounted.has(source)) throw new Error('This textarea already has an editor.')
  mounted.add(source)

  const host = document.createElement('div')
  const error = document.createElement('p')
  error.setAttribute('role', 'alert')
  error.hidden = true
  const root = document.createElement('div')
  root.setAttribute('role', 'group')
  root.setAttribute(
    'aria-label',
    Array.from(source.labels || [], (label) => label.textContent.trim()).join(' ') ||
      'Rich text editor',
  )
  root.append(host, error)
  source.after(root)
  const originalHidden = source.hidden
  const originalValidity = source.validity.customError ? source.validationMessage : ''
  source.hidden = true
  const props = reactive({
    modelValue: source.value,
    placeholder: source.placeholder,
    direction: source.dir || 'ltr',
  })
  for (const key of configurable) if (Object.hasOwn(options, key)) props[key] = options[key]
  if (options.mediaAdapter) props.mediaAdapter = options.mediaAdapter
  if (options.assistanceAdapter) props.assistanceAdapter = options.assistanceAdapter
  if (Object.hasOwn(options, 'readonly')) source.readOnly = !!options.readonly
  if (Object.hasOwn(options, 'disabled')) source.disabled = !!options.disabled
  function mode() {
    props.readonly = source.readOnly
    props.disabled = source.matches(':disabled')
  }
  mode()
  let api,
    instance,
    app,
    pinia,
    disposed = false,
    sending = false,
    baseline = '',
    timer,
    resetTimer
  function validate() {
    const content = document.createElement('template')
    content.innerHTML = source.value
    const empty =
      !content.content.textContent.replace(/[\s\u200b\ufeff]/g, '') &&
      !content.content.querySelector('img,video,audio,iframe,table,hr,svg,math')
    const message = props.locale === 'tr' ? 'Lütfen içerik girin.' : 'Please enter content.'
    source.setCustomValidity(originalValidity || (source.required && empty ? message : ''))
    if (source.validity.valid) {
      error.hidden = true
      root.removeAttribute('aria-invalid')
    }
  }
  function changed(html) {
    if (disposed) return
    props.modelValue = html
    source.value = html
    validate()
    sending = true
    try {
      source.dispatchEvent(new Event('input', { bubbles: true }))
      source.dispatchEvent(new Event('change', { bubbles: true }))
    } finally {
      sending = false
    }
    options.onChange?.(html, instance)
  }
  function input() {
    if (sending || disposed) return
    props.modelValue = source.value
    api?.setHTML(source.value)
    validate()
  }
  function invalid(event) {
    event.preventDefault()
    error.textContent = source.validationMessage
    error.hidden = false
    root.setAttribute('aria-invalid', 'true')
    api?.focus()
  }
  function reset(event) {
    if (event.target !== source.form) return
    clearTimeout(resetTimer)
    resetTimer = setTimeout(async () => {
      if (disposed || event.defaultPrevented) return
      input()
      await nextTick()
      if (disposed) return
      source.value = api?.getHTML() ?? source.value
      baseline = source.value
      validate()
    })
  }
  function label(event) {
    if (root.contains(event.target)) return
    if (event.target.closest?.('label')?.control !== source || props.disabled) return
    event.preventDefault()
    api?.focus()
  }
  const observer = new MutationObserver(() => {
    mode()
    validate()
  })
  observer.observe(source, {
    attributes: true,
    attributeFilter: ['readonly', 'disabled', 'required'],
  })
  for (let parent = source.parentElement; parent; parent = parent.parentElement)
    if (parent.tagName === 'FIELDSET')
      observer.observe(parent, { attributes: true, attributeFilter: ['disabled'] })
  source.addEventListener('input', input)
  source.addEventListener('invalid', invalid)
  document.addEventListener('reset', reset, true)
  document.addEventListener('click', label)
  function destroy() {
    if (disposed) return
    disposed = true
    clearTimeout(timer)
    clearTimeout(resetTimer)
    observer.disconnect()
    source.removeEventListener('input', input)
    source.removeEventListener('invalid', invalid)
    document.removeEventListener('reset', reset, true)
    document.removeEventListener('click', label)
    try {
      app?.unmount()
    } finally {
      if (pinia) disposePinia(pinia)
      root.remove()
      source.hidden = originalHidden
      source.setCustomValidity(originalValidity)
      mounted.delete(source)
    }
  }
  try {
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        destroy()
        reject(new Error('Editor initialization timed out.'))
      }, 30000)
      app = createApp({
        render: () =>
          h(StudioEditor, {
            ...props,
            'onUpdate:modelValue': changed,
            'onUpdate:contentCss': (urls) => {
              props.contentCss = urls
              options.onContentCssChange?.(urls)
            },
            onContentCssStatus: (status) => options.onContentCssStatus?.(status),
            'onUpdate:bodyClass': (value) => {
              props.bodyClass = value
              options.onBodyClassChange?.(value)
            },
            onSave: (html) => options.onSave?.(html, instance),
            onReady: (editor) => {
              api = editor
              source.value = api.getHTML()
              props.modelValue = source.value
              baseline = source.value
              validate()
              instance = {
                ...api,
                isDirty: () => !disposed && api.getHTML() !== baseline,
                markClean: () => {
                  baseline = api.getHTML()
                },
                setOptions: (updates) => {
                  if (disposed) throw new Error('This editor has been destroyed.')
                  for (const key of configurable)
                    if (Object.hasOwn(updates, key)) props[key] = updates[key]
                  if (Object.hasOwn(updates, 'readonly')) source.readOnly = !!updates.readonly
                  if (Object.hasOwn(updates, 'disabled')) source.disabled = !!updates.disabled
                  mode()
                  validate()
                },
                destroy,
              }
              clearTimeout(timer)
              resolve(instance)
            },
          }),
      })
      pinia = createPinia()
      app.use(pinia)
      app.mount(host)
    })
  } catch (failure) {
    destroy()
    throw failure
  }
}
