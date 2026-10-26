import { createApp, h, reactive } from 'vue'
import { createPinia, disposePinia } from 'pinia'
import StudioEditor from './StudioEditor.vue'

const textAttributes = {
  locale: 'locale',
  theme: 'theme',
  placeholder: 'placeholder',
  direction: 'direction',
  'body-class': 'bodyClass',
  'paste-mode': 'pasteMode',
  'table-paste-style': 'tablePasteStyle',
}
const booleanAttributes = {
  readonly: 'readonly',
  disabled: 'disabled',
  'allow-create-mention': 'allowCreateMention',
  restricted: 'restricted',
  'track-changes': 'trackChanges',
}
const listAttributes = { toolbar: 'toolbar', menubar: 'menubar', 'content-css': 'contentCss' }
const observed = [
  ...Object.keys(textAttributes),
  ...Object.keys(booleanAttributes),
  ...Object.keys(listAttributes),
  'height',
  'disable-features',
  'required',
]
const words = (value) =>
  String(value || '')
    .split(/[\s,]+/)
    .filter(Boolean)
function listValue(name, value) {
  if (value === null) return name === 'content-css' ? [] : true
  if (name !== 'content-css' && ['', 'true'].includes(value.trim())) return true
  if (name !== 'content-css' && ['false', 'none'].includes(value.trim())) return false
  return words(value)
}
const emptyContent = (html) => {
  const template = document.createElement('template')
  template.innerHTML = html
  return (
    !template.content.textContent.replace(/[\s\u200b\ufeff]/g, '') &&
    !template.content.querySelector('img,video,audio,iframe,table,hr,svg,math,figure')
  )
}

/**
 * Registers `<studio-editor>` (or a custom tag). The element is form-associated, so its HTML is
 * submitted under its `name`. It renders in light DOM: include the package stylesheet once.
 */
export function defineStudioEditorElement(tagName = 'studio-editor') {
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined')
    throw new Error('Custom elements require a browser.')
  const existing = customElements.get(tagName)
  if (existing) return existing
  class StudioEditorElement extends HTMLElement {
    static formAssociated = true
    static observedAttributes = observed
    #internals = this.attachInternals()
    #props = reactive({ modelValue: '' })
    #features = {}
    #disabledFeatures = {}
    #app = null
    #pinia = null
    #api = null
    #value = null
    #defaultValue = ''
    #formDisabled = false
    #ready
    #resolveReady
    constructor() {
      super()
      this.#ready = new Promise((resolve) => (this.#resolveReady = resolve))
    }
    connectedCallback() {
      if (this.#app) return
      const template = this.querySelector(':scope > template')
      const initial = this.#value ?? this.getAttribute('value') ?? template?.innerHTML ?? ''
      this.#defaultValue = initial
      this.#props.modelValue = initial
      for (const name of observed) this.#attribute(name)
      const host = document.createElement('div')
      this.replaceChildren(host)
      this.#sync(initial)
      const element = this
      this.#app = createApp({
        render: () =>
          h(StudioEditor, {
            ...element.#props,
            disabled: element.#props.disabled || element.#formDisabled,
            'onUpdate:modelValue': (html) => element.#changed(html),
            onReady: (api) => {
              element.#api = api
              element.#props.modelValue = api.getHTML()
              element.#sync(element.#props.modelValue)
              element.#resolveReady(element)
              element.#dispatch('studio-ready', { editor: api })
            },
            onSave: (html) => element.#dispatch('studio-save', { html }),
            onTransaction: (transaction) => element.#dispatch('studio-transaction', transaction),
            onCrash: (crash) => element.#dispatch('studio-crash', crash),
          }),
      })
      this.#pinia = createPinia()
      this.#app.use(this.#pinia)
      this.#app.mount(host)
    }
    disconnectedCallback() {
      // Moving the element reconnects it in the same task; only a real removal unmounts.
      queueMicrotask(() => {
        if (!this.isConnected) this.#destroy()
      })
    }
    attributeChangedCallback(name) {
      this.#attribute(name)
    }
    #attribute(name) {
      const value = this.getAttribute(name)
      if (textAttributes[name]) {
        if (value === null) delete this.#props[textAttributes[name]]
        else this.#props[textAttributes[name]] = value
      } else if (booleanAttributes[name]) this.#props[booleanAttributes[name]] = value !== null
      else if (listAttributes[name]) this.#props[listAttributes[name]] = listValue(name, value)
      else if (name === 'height') {
        if (value === null) delete this.#props.height
        else this.#props.height = /^\d+$/.test(value.trim()) ? Number(value) : value
      } else if (name === 'disable-features') {
        this.#disabledFeatures = Object.fromEntries(words(value).map((key) => [key, false]))
        this.#props.features = { ...this.#features, ...this.#disabledFeatures }
      } else if (name === 'required') this.#validate()
    }
    #changed(html) {
      this.#props.modelValue = html
      this.#sync(html)
      this.#dispatch('input')
      this.#dispatch('change')
    }
    #sync(html) {
      this.#internals.setFormValue(html)
      this.#validate(html)
    }
    #validate(html = this.value) {
      if (this.hasAttribute('required') && emptyContent(html))
        this.#internals.setValidity(
          { valueMissing: true },
          this.#props.locale === 'tr' ? 'Lütfen içerik girin.' : 'Please enter content.',
        )
      else this.#internals.setValidity({})
    }
    #dispatch(type, detail) {
      this.dispatchEvent(
        detail === undefined
          ? new Event(type, { bubbles: true, composed: true })
          : new CustomEvent(type, { bubbles: true, composed: true, detail }),
      )
    }
    #destroy() {
      try {
        this.#app?.unmount()
      } finally {
        if (this.#pinia) disposePinia(this.#pinia)
        this.#app = this.#pinia = this.#api = null
        this.#value = this.#props.modelValue
        this.#ready = new Promise((resolve) => (this.#resolveReady = resolve))
      }
    }
    /** Resolves once the editing iframe is ready. */
    whenReady() {
      return this.#ready
    }
    /** The StudioEditorApi of the mounted editor, or null before it is ready. */
    get editor() {
      return this.#api
    }
    get value() {
      return this.#api?.getHTML() ?? this.#props.modelValue ?? ''
    }
    set value(html) {
      const value = String(html ?? '')
      this.#value = value
      this.#props.modelValue = value
      if (this.#api) this.#api.setHTML(value)
      else this.#sync(value)
    }
    get form() {
      return this.#internals.form
    }
    get name() {
      return this.getAttribute('name')
    }
    get validity() {
      return this.#internals.validity
    }
    get validationMessage() {
      return this.#internals.validationMessage
    }
    checkValidity() {
      return this.#internals.checkValidity()
    }
    reportValidity() {
      return this.#internals.reportValidity()
    }
    getHTML() {
      return this.value
    }
    getPublicHTML() {
      return this.#api?.getPublicHTML() ?? this.value
    }
    focus() {
      this.#api?.focus()
    }
    formResetCallback() {
      this.value = this.#defaultValue
    }
    formDisabledCallback(disabled) {
      this.#formDisabled = disabled
      this.#props.disabled = this.hasAttribute('disabled')
    }
    formStateRestoreCallback(state) {
      if (typeof state === 'string') this.value = state
    }
    // Object-valued options are element properties. Adapters are read when the editor mounts,
    // so set mediaAdapter before inserting the element.
    get features() {
      return this.#features
    }
    set features(value) {
      this.#features = { ...value }
      this.#props.features = { ...this.#features, ...this.#disabledFeatures }
    }
    get mentions() {
      return this.#props.mentions
    }
    set mentions(value) {
      this.#props.mentions = value
    }
    get messages() {
      return this.#props.messages
    }
    set messages(value) {
      this.#props.messages = value
    }
    get contentCss() {
      return this.#props.contentCss
    }
    set contentCss(value) {
      this.#props.contentCss = value
    }
    get mediaAdapter() {
      return this.#props.mediaAdapter
    }
    set mediaAdapter(value) {
      this.#props.mediaAdapter = value
    }
    get assistanceAdapter() {
      return this.#props.assistanceAdapter
    }
    set assistanceAdapter(value) {
      this.#props.assistanceAdapter = value
    }
    /** Author of tracked changes: { id, name }. */
    get user() {
      return this.#props.user
    }
    set user(value) {
      this.#props.user = value
    }
    get documentSession() {
      return this.#props.documentSession
    }
    set documentSession(value) {
      this.#props.documentSession = value
    }
  }
  customElements.define(tagName, StudioEditorElement)
  return StudioEditorElement
}
