import { sciencePng } from './science.js'

// Mermaid diagrams are stored like science images: a PNG with its editable source.
const maxSource = 20000
const examples = {
  tr: {
    flowchart:
      'flowchart LR\n  A[Taslak] --> B{İnceleme}\n  B -->|Onay| C[Yayın]\n  B -->|Düzelt| A',
    sequence:
      'sequenceDiagram\n  participant Y as Yazar\n  participant E as Editör\n  Y->>E: Taslağı gönder\n  E-->>Y: Geri bildirim',
    gantt:
      'gantt\n  title Yayın planı\n  dateFormat YYYY-MM-DD\n  section Hazırlık\n  Taslak :a1, 2026-11-02, 5d\n  İnceleme :after a1, 3d',
    class:
      'classDiagram\n  class Belge {\n    +String baslik\n    +kaydet()\n  }\n  Belge <|-- Rapor',
    state:
      'stateDiagram-v2\n  [*] --> Taslak\n  Taslak --> Inceleme\n  Inceleme --> Yayinda\n  Yayinda --> [*]',
    pie: 'pie title İçerik türleri\n  "Makale" : 45\n  "Rehber" : 30\n  "Duyuru" : 25',
  },
  en: {
    flowchart:
      'flowchart LR\n  A[Draft] --> B{Review}\n  B -->|Approve| C[Publish]\n  B -->|Revise| A',
    sequence:
      'sequenceDiagram\n  participant A as Author\n  participant E as Editor\n  A->>E: Send draft\n  E-->>A: Feedback',
    gantt:
      'gantt\n  title Publishing plan\n  dateFormat YYYY-MM-DD\n  section Preparation\n  Draft :a1, 2026-11-02, 5d\n  Review :after a1, 3d',
    class:
      'classDiagram\n  class Document {\n    +String title\n    +save()\n  }\n  Document <|-- Report',
    state:
      'stateDiagram-v2\n  [*] --> Draft\n  Draft --> Review\n  Review --> Published\n  Published --> [*]',
    pie: 'pie title Content types\n  "Articles" : 45\n  "Guides" : 30\n  "News" : 25',
  },
}
export const diagramKinds = Object.keys(examples.en)
export const diagramExample = (kind, locale = 'en') =>
  examples[locale === 'tr' ? 'tr' : 'en'][kind] || examples.en.flowchart

// Mermaid arrows ("-->") would be stripped by the sanitizer's XML safety check, so the
// source is stored URI-encoded.
export const encodeDiagramSource = (source) => encodeURIComponent(source)
export function readDiagram(node) {
  if (node?.tagName !== 'IMG' || node.getAttribute('data-studio-diagram') !== 'mermaid') return null
  let source
  try {
    source = decodeURIComponent(node.getAttribute('data-studio-source') || '')
  } catch {
    return null
  }
  return source && source.length <= maxSource ? { kind: 'mermaid', source } : null
}

let mermaidModule = null
let queue = Promise.resolve()
let sequence = 0
async function mermaid() {
  if (mermaidModule) return mermaidModule
  const { default: instance } = await import('mermaid')
  // Pure SVG labels keep the canvas untainted so the diagram can become a PNG.
  instance.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'default',
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    fontFamily: 'Arial, Helvetica, sans-serif',
    suppressErrorRendering: true,
  })
  mermaidModule = instance
  return instance
}

function measure(svg) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  if (root.nodeName !== 'svg') throw new Error('Diagram output is not SVG.')
  const box = (root.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
  let width = box.length === 4 ? box[2] : parseFloat(root.getAttribute('width'))
  let height = box.length === 4 ? box[3] : parseFloat(root.getAttribute('height'))
  if (!(width > 0 && height > 0)) throw new Error('Diagram has no size.')
  // Keep large diagrams within the canvas limits used for science images.
  const scale = Math.min(1, 1600 / width, 1200 / height)
  width = Math.round(width * scale)
  height = Math.round(height * scale)
  root.setAttribute('width', String(width))
  root.setAttribute('height', String(height))
  root.removeAttribute('style')
  return { svg: new XMLSerializer().serializeToString(root), width, height }
}
function svgDataUrl(svg) {
  let binary = ''
  for (const byte of new TextEncoder().encode(svg)) binary += String.fromCharCode(byte)
  return `data:image/svg+xml;base64,${btoa(binary)}`
}

/** Renders Mermaid source to an image. Rendering is serialized; Mermaid is not reentrant. */
export function renderDiagram(source) {
  const job = queue.then(async () => {
    const text = String(source || '').trim()
    if (!text) throw new Error('Diyagram kaynağını yazın.')
    if (text.length > maxSource)
      throw new Error('Diyagram kaynağı en fazla 20.000 karakter olabilir.')
    const instance = await mermaid()
    await instance.parse(text)
    const { svg } = await instance.render(`studio-diagram-${++sequence}`, text)
    const measured = measure(svg)
    try {
      return { ...(await sciencePng(measured)), svg: measured.svg }
    } catch {
      // Some diagram types still draw HTML labels; an SVG image is the safe fallback.
      return { src: svgDataUrl(measured.svg), width: measured.width, svg: measured.svg }
    }
  })
  queue = job.catch(() => {})
  return job
}

export function applyDiagram(engine, target, { source, src, width, alt }) {
  if (!engine?.editable || engine.destroyed || (target && !engine.root.contains(target)))
    return false
  if (!/^data:image\/(png|svg\+xml);base64,/.test(src)) return false
  const node = engine.doc.createElement('img')
  node.setAttribute('data-studio-diagram', 'mermaid')
  node.setAttribute('data-studio-source', encodeDiagramSource(source))
  if (!readDiagram(node)) return false
  node.src = src
  node.alt = (alt || '').slice(0, 500) || source.split('\n')[0].slice(0, 200)
  node.style.cssText = `width:${Math.min(width, 720)}px;max-width:100%;height:auto`
  engine.transaction((range) => {
    if (target) {
      node.style.cssText = target.style.cssText
      target.replaceWith(node)
      engine.selectImage(node)
    } else engine.insertFragment(`<p>${node.outerHTML}</p>`, range)
  }, 'diagram')
  return true
}
