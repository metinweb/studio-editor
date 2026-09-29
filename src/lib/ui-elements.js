// Framework-independent, versioned UI definitions. Only these renderers create controls.
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
const text = (value, max = 200) => (typeof value === 'string' ? value.slice(0, max) : '')
const fail = (message) => {
  throw new Error(message)
}
export const uiFieldTypes = [
  'text',
  'email',
  'tel',
  'url',
  'number',
  'date',
  'textarea',
  'select',
  'radio',
  'checkbox',
  'range',
]
export function uiUrl(value, relative = true) {
  if (!value) return ''
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value))
    return null
  if (relative && /^\/(?!\/)/.test(value)) return value
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}
export function normalizeUiElement(input) {
  if (!input || input.version !== 1 || !['form', 'slider', 'accordion'].includes(input.kind))
    fail('Unsupported UI element.')
  if (!/^[a-zA-Z][\w-]{0,79}$/.test(input.id || '')) fail('Invalid UI element ID.')
  const value = {
    version: 1,
    kind: input.kind,
    id: input.id,
    title: text(input.title),
    description: text(input.description, 1000),
    accent: /^#[\da-f]{6}$/i.test(input.accent || '') ? input.accent : '#2563eb',
  }
  if (input.kind === 'form') {
    const action = uiUrl(input.action)
    if (action === null) fail('Use an HTTPS or root-relative form action.')
    if (!Array.isArray(input.fields) || !input.fields.length || input.fields.length > 40)
      fail('Add between 1 and 40 fields.')
    const names = new Set()
    value.action = action
    value.submitLabel = text(input.submitLabel) || 'Submit'
    value.columns = input.columns === 2 ? 2 : 1
    value.fields = input.fields.map((field) => {
      if (!field || !uiFieldTypes.includes(field.type)) fail('Invalid field type.')
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(field.name || '') || names.has(field.name))
        fail('Field names must be unique: letters, numbers and underscores; start with a letter.')
      names.add(field.name)
      if (!text(field.label).trim()) fail('Every field needs a label.')
      const result = {
        type: field.type,
        name: field.name,
        label: text(field.label),
        help: text(field.help, 500),
        placeholder: text(field.placeholder),
        required: field.required === true,
        fullWidth: field.fullWidth === true,
      }
      if (['select', 'radio'].includes(field.type)) {
        if (
          !Array.isArray(field.options) ||
          !field.options.length ||
          field.options.length > 30 ||
          field.options.some(
            (option) => typeof option !== 'string' || !option.trim() || option.length > 120,
          ) ||
          new Set(field.options).size !== field.options.length
        )
          fail('Add 1–30 distinct, nonempty options (up to 120 characters).')
        result.options = [...field.options]
      }
      if (['number', 'range'].includes(field.type)) {
        result.min = Number(field.min ?? 0)
        result.max = Number(field.max ?? 100)
        result.step = Number(field.step ?? 1)
        if (
          ![result.min, result.max, result.step].every(Number.isFinite) ||
          result.min >= result.max ||
          result.step <= 0 ||
          Math.max(Math.abs(result.min), Math.abs(result.max)) > 1e9
        )
          fail('Use valid minimum, maximum and a positive step.')
      }
      return result
    })
  } else {
    if (!Array.isArray(input.items) || !input.items.length || input.items.length > 20)
      fail('Add between 1 and 20 items.')
    value.items = input.items.map((item) => {
      if (!item || !text(item.title).trim()) fail('Every item needs a title.')
      const result = { title: text(item.title), text: text(item.text, 4000) }
      if (input.kind === 'slider') {
        result.image = uiUrl(item.image)
        result.link = uiUrl(item.link)
        if (result.image === null || result.link === null)
          fail('Use HTTPS or root-relative image/link URLs.')
        result.alt = text(item.alt)
        result.linkLabel = text(item.linkLabel) || 'Read more'
        if (result.image && !result.alt.trim()) fail('Add alternative text for each image.')
      } else result.open = item.open === true
      return result
    })
    if (input.kind === 'slider') {
      value.cards = [1, 2, 3].includes(input.cards) ? input.cards : 1
      value.ratio = ['16/9', '4/3', '1/1'].includes(input.ratio) ? input.ratio : '16/9'
    }
  }
  return value
}
export function readUiElement(node) {
  if (!node?.matches?.('figure[data-studio-ui]')) return null
  const raw = node.getAttribute('data-studio-ui-config') || ''
  if (raw.length > 150000) return null
  try {
    const config = normalizeUiElement(JSON.parse(raw))
    return config.kind === node.dataset.studioUi ? config : null
  } catch {
    return null
  }
}
export function newUiElement(kind, locale = 'en') {
  if (!['form', 'slider', 'accordion'].includes(kind)) fail('Unsupported UI element.')
  const tr = locale === 'tr'
  const base = {
    version: 1,
    id: `ui-${crypto.randomUUID()}`,
    kind,
    title: '',
    description: '',
    accent: '#2563eb',
  }
  if (kind === 'form')
    return {
      ...base,
      title: tr ? 'İletişim' : 'Get in touch',
      description: tr ? 'Size nasıl yardımcı olabiliriz?' : 'How can we help you?',
      action: '',
      submitLabel: tr ? 'Gönder' : 'Send message',
      columns: 1,
      fields: [
        { type: 'text', name: 'name', label: tr ? 'Adınız' : 'Your name', required: true },
        { type: 'email', name: 'email', label: tr ? 'E-posta' : 'Email', required: true },
        {
          type: 'textarea',
          name: 'message',
          label: tr ? 'Mesajınız' : 'Message',
          required: true,
          fullWidth: true,
        },
      ],
    }
  return {
    ...base,
    title:
      kind === 'slider'
        ? tr
          ? 'Öne çıkanlar'
          : 'Highlights'
        : tr
          ? 'Sık sorulan sorular'
          : 'Frequently asked questions',
    cards: 1,
    ratio: '16/9',
    items: [
      {
        title: tr ? 'Birinci öğe' : 'First item',
        text: tr ? 'İçeriğinizi buraya yazın.' : 'Tell your story here.',
        open: true,
      },
      {
        title: tr ? 'İkinci öğe' : 'Second item',
        text: tr ? 'Daha fazla bilgi ekleyin.' : 'Add more details here.',
      },
    ],
  }
}
const boxStyle =
  'box-sizing:border-box;border:1px solid #dbe2ed;border-radius:16px;padding:24px;background:#fff;color:#17253e;font-family:system-ui,sans-serif;line-height:1.5;max-width:100%;margin:20px 0;'
const controlStyle =
  'box-sizing:border-box;display:block;width:100%;max-width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;font:inherit;background:#fff;color:#17253e;'
const paragraph = (value) => esc(value).replace(/\n/g, '<br>')
export function uiElementHtml(input, mode = 'portable') {
  const c = normalizeUiElement(input)
  const metadata = `data-studio-ui="${c.kind}" data-studio-ui-config="${esc(JSON.stringify(c))}"`
  const heading = `${c.title ? `<h2 style="font-size:24px;margin:0 0 8px;color:${c.accent}">${esc(c.title)}</h2>` : ''}${c.description ? `<p style="margin:0 0 20px;color:#52627a">${paragraph(c.description)}</p>` : ''}`
  let content
  if (mode === 'portable')
    content = `${heading}<p>${esc(c.kind)} · ${c.fields?.length || c.items.length}</p>`
  else if (c.kind === 'form') {
    const fields = c.fields
      .map((field, index) => {
        const id = `${c.id}-field-${index}`,
          required = field.required ? ' required' : '',
          help = field.help ? ` aria-describedby="${id}-help"` : ''
        const label = `${esc(field.label)}${field.required ? ' <span aria-hidden="true">*</span>' : ''}`
        let control
        const common = `id="${id}" name="${field.name}"${required}${help}`
        if (mode === 'editor')
          control = `<div style="${controlStyle}min-height:${field.type === 'textarea' ? 70 : 42}px;background:#f8fafc;color:#64748b">${esc(field.placeholder || (field.options ? field.options.join(' / ') : field.type === 'checkbox' ? '☐' : field.type === 'range' ? `${field.min} ━━━●━━ ${field.max}` : '…'))}</div>`
        else if (field.type === 'textarea')
          control = `<textarea ${common} rows="4" maxlength="10000" placeholder="${esc(field.placeholder)}" style="${controlStyle}resize:vertical"></textarea>`
        else if (field.type === 'select')
          control = `<select ${common} style="${controlStyle}"><option value="">${esc(field.placeholder || '—')}</option>${field.options.map((option) => `<option value="${esc(option)}">${esc(option)}</option>`).join('')}</select>`
        else if (field.type === 'radio')
          control = `<fieldset style="border:0;padding:0;margin:0"${help}><legend style="font-weight:600">${label}</legend>${field.options.map((option, j) => `<label style="display:block;margin:8px 0"><input type="radio" name="${field.name}" value="${esc(option)}"${required}> ${esc(option)}</label>`).join('')}</fieldset>`
        else if (field.type === 'checkbox')
          control = `<label style="display:flex;gap:8px;align-items:baseline"><input type="checkbox" ${common} value="yes"> <span>${label}</span></label>`
        else
          control = `<input type="${field.type}" ${common} placeholder="${esc(field.placeholder)}"${['number', 'range'].includes(field.type) ? ` min="${field.min}" max="${field.max}" step="${field.step}"` : ''}${field.type === 'range' ? ` value="${field.min}"` : ''} style="${controlStyle}">`
        return `<div style="min-width:0;${field.fullWidth ? 'grid-column:1/-1;' : ''}">${mode === 'editor' ? `<div style="font-weight:600;margin-bottom:6px">${label}</div>` : ['radio', 'checkbox'].includes(field.type) ? '' : `<label for="${id}" style="display:block;font-weight:600;margin-bottom:6px">${label}</label>`}${control}${field.help ? `<small id="${id}-help" style="display:block;color:#52627a;margin-top:6px">${paragraph(field.help)}</small>` : ''}</div>`
      })
      .join('')
    const grid = `display:grid;gap:18px;grid-template-columns:${c.columns === 2 ? 'repeat(auto-fit,minmax(min(100%,240px),1fr))' : 'minmax(0,1fr)'};`
    const button = `border:0;border-radius:8px;padding:12px 20px;background:${c.accent};color:white;font:inherit;`
    content =
      mode === 'editor'
        ? `${heading}<div style="${grid}">${fields}</div><p><span style="${button}display:inline-block">${esc(c.submitLabel)}</span></p>`
        : `${heading}<form${c.action ? ` action="${esc(c.action)}"` : ''} method="post" accept-charset="UTF-8" aria-label="${esc(c.title || 'Form')}"><fieldset${!c.action || mode === 'preview' ? ' disabled' : ''} style="border:0;padding:0;margin:0;min-width:0"><div style="${grid}">${fields}</div><button type="submit" style="${button}margin-top:20px">${esc(c.submitLabel)}</button></fieldset></form>`
  } else if (c.kind === 'slider') {
    const slides = c.items
      .map(
        (item, i) =>
          `<article id="${c.id}-slide-${i}" style="box-sizing:border-box;flex:0 0 ${100 / c.cards}%;min-width:min(240px,100%);scroll-snap-align:start;padding:4px 8px 12px;overflow-wrap:anywhere">${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.alt)}" loading="lazy" style="width:100%;aspect-ratio:${c.ratio};object-fit:cover;border-radius:12px;display:block">` : `<div aria-hidden="true" style="aspect-ratio:${c.ratio};border-radius:12px;background:${c.accent}18;display:grid;place-items:center;font-size:48px;color:${c.accent}">${String(i + 1).padStart(2, '0')}</div>`}<h3 style="margin:16px 0 8px;font-size:20px">${esc(item.title)}</h3><p style="margin:0 0 12px;color:#52627a">${paragraph(item.text)}</p>${item.link ? `<a href="${esc(item.link)}" style="color:${c.accent}">${esc(item.linkLabel)}</a>` : ''}</article>`,
      )
      .join('')
    content = `${heading}<div role="region" aria-roledescription="carousel" aria-label="${esc(c.title || 'Slider')}" tabindex="0" style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:0;max-width:100%">${slides}</div><nav aria-label="Slides" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${c.items.map((_, i) => `<a href="#${c.id}-slide-${i}" aria-label="${i + 1}" style="display:inline-block;padding:4px 12px;border:1px solid #cbd5e1;border-radius:20px;color:${c.accent}">${i + 1}</a>`).join('')}</nav>`
  } else
    content = `${heading}${c.items.map((item) => (mode === 'editor' ? `<div style="border-top:1px solid #e2e8f0;padding:14px 0"><strong>⌄ ${esc(item.title)}</strong><p style="color:#52627a;margin:8px 0">${paragraph(item.text)}</p></div>` : `<details${item.open ? ' open' : ''} style="border-top:1px solid #e2e8f0;padding:14px 0"><summary style="cursor:pointer;font-weight:600">${esc(item.title)}</summary><p style="color:#52627a;margin:8px 0">${paragraph(item.text)}</p></details>`)).join('')}`
  return `<figure ${metadata}${mode === 'editor' ? ' contenteditable="false" tabindex="0" role="group"' : ''} style="${boxStyle}">${content}</figure>`
}
export function normalizeUiElements(root, mode = 'editor') {
  const used = new Set(
    [...root.querySelectorAll('[id]:not(figure[data-studio-ui] *)')].map((node) => node.id),
  )
  for (const node of root.querySelectorAll('figure[data-studio-ui]')) {
    if (!root.contains(node)) continue
    const config = readUiElement(node)
    if (!config) {
      const fallback = root.ownerDocument.createElement('p')
      fallback.textContent = 'Invalid UI element'
      node.replaceWith(fallback)
      continue
    }
    let id = config.id,
      suffix = 1
    while (used.has(id) || [...used].some((value) => value.startsWith(`${id}-`)))
      id = `${config.id.slice(0, 65)}-${suffix++}`
    config.id = id
    used.add(id)
    node.outerHTML = uiElementHtml(config, mode)
  }
}
