import { mathjax } from '@mathjax/src/js/mathjax.js'
import { TeX } from '@mathjax/src/js/input/tex.js'
import { SVG } from '@mathjax/src/js/output/svg.js'
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js'
import { MathJaxTexFont } from '@mathjax/mathjax-tex-font/js/svg.js'
import { MathJaxMhchemFontExtension } from '@mathjax/mathjax-mhchem-font-extension/js/svg.js'
import '@mathjax/src/js/input/tex/base/BaseConfiguration.js'
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js'
import '@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js'

const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)
MathJaxTexFont.addExtension(MathJaxMhchemFontExtension)

export function equationSvg(source, kind = 'math') {
  if (typeof source !== 'string' || !source.trim() || source.length > 4000)
    throw new Error('Invalid formula')
  // Each conversion gets isolated TeX state; no require, HTML, URL or user-defined macro packages.
  const tex = new TeX({
    packages: ['base', 'ams', 'mhchem'],
    maxBuffer: 8000,
    maxMacros: 1000,
    maxTemplateSubtitutions: 1000,
    formatError(_jax, error) {
      throw error
    },
  })
  const output = new SVG({ fontCache: 'none', fontData: MathJaxTexFont })
  const doc = mathjax.document('', { InputJax: tex, OutputJax: output })
  const node = doc.convert(kind === 'chemistry' ? `\\ce{${source}}` : source, {
    display: true,
    em: 20,
    ex: 10,
    containerWidth: 600,
  })
  const svgNode = adaptor.tags(node, 'svg')[0]
  if (!svgNode) throw new Error('Invalid formula')
  const box = adaptor.getAttribute(svgNode, 'viewBox').split(/\s+/).map(Number)
  const width = Math.ceil((box[2] / 1000) * 20 + 16),
    height = Math.ceil((box[3] / 1000) * 20 + 16)
  adaptor.setAttribute(
    svgNode,
    'viewBox',
    `${box[0] - 400} ${box[1] - 400} ${box[2] + 800} ${box[3] + 800}`,
  )
  adaptor.setAttribute(svgNode, 'width', String(width))
  adaptor.setAttribute(svgNode, 'height', String(height))
  adaptor.setAttribute(svgNode, 'style', 'color:#172238')
  return { svg: adaptor.outerHTML(svgNode), width, height }
}
