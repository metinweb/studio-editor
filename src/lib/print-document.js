import { publicHtml, documentCss, escapeHtml } from './content'
export function printOptions(options = {}) {
  return {
    size: options.size === 'Letter' ? 'Letter' : 'A4',
    landscape: !!options.landscape,
    margin: Math.max(10, Math.min(40, Number(options.margin) || 20)),
    header: String(options.header || '').slice(0, 200),
    footer: String(options.footer || '').slice(0, 200),
  }
}
export function renderPrintDocument(html, options = {}) {
  const value = printOptions(options)
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="script-src 'none';object-src 'none';base-uri 'none'"><title>${escapeHtml(value.header || 'Studio')}</title><style>${documentCss}
  @page{size:${value.size} ${value.landscape ? 'landscape' : 'portrait'};margin:${value.margin}mm}
  body{max-width:none;margin:0;padding:0;background:white}img{max-width:100%}table{max-width:100%;border-collapse:collapse}thead{display:table-header-group}tfoot{display:table-footer-group}tr,img{break-inside:avoid}h1,h2,h3,h4{break-after:avoid}p{orphans:3;widows:3}[data-studio-page-break]{break-before:page}
  .print-header,.print-footer{font:11px Arial;color:#64748b;padding:4px 0}
  @media print{.print-header,.print-footer{position:fixed;left:0;right:0}.print-header{top:-${Math.max(6, value.margin - 5)}mm}.print-footer{bottom:-${Math.max(6, value.margin - 5)}mm}}
  </style></head><body><header class="print-header">${escapeHtml(value.header)}</header>${publicHtml(html)}<footer class="print-footer">${escapeHtml(value.footer)}</footer></body></html>`
}
export function printDocument(html, options) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.style.cssText = 'position:fixed;left:-10000px;width:800px;height:1000px'
    frame.title = 'Studio print'
    frame.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-modals')
    const clean = () => {
      clearTimeout(timeout)
      frame.remove()
    }
    const timeout = setTimeout(() => {
      clean()
      reject(new Error('Yazdırma zaman aşımına uğradı.'))
    }, 120000)
    frame.onload = async () => {
      try {
        await Promise.race([
          Promise.allSettled([...frame.contentDocument.images].map((img) => img.decode())),
          new Promise((r) => setTimeout(r, 5000)),
        ])
        await frame.contentDocument.fonts.ready
        frame.contentWindow.addEventListener('afterprint', clean, { once: true })
        frame.contentWindow.focus()
        frame.contentWindow.print()
        resolve()
      } catch (error) {
        clean()
        reject(error)
      }
    }
    frame.srcdoc = renderPrintDocument(html, options)
    document.body.append(frame)
  })
}
