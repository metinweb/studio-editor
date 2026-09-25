import { zipSync, strToU8 } from 'fflate'
import { publicHtml, escapeHtml } from './content'
import { printOptions } from './print-document'
import { tableGrid } from '../editor/table-grid.js'
const xml = (value) =>
  escapeHtml(String(value)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const relationships = 'http://schemas.openxmlformats.org/package/2006/relationships'
const office = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const wrap = (name, body) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><${name} xmlns:w="${ns}" xmlns:r="${office}">${body}</${name}>`
export async function exportDocx(html, options = {}) {
  const settings = printOptions(options),
    doc = new DOMParser().parseFromString(publicHtml(html), 'text/html'),
    files = {},
    rels = [],
    numbers = []
  let imageIndex = 0,
    totalBytes = 0
  const relation = (type, target, external = false) => {
    const id = `rId${rels.length + 1}`
    rels.push(
      `<Relationship Id="${id}" Type="${office}/${type}" Target="${xml(target)}"${external ? ' TargetMode="External"' : ''}/>`,
    )
    return id
  }
  async function image(node) {
    const imageId = ++imageIndex
    if (imageId > 50) throw new Error('DOCX en fazla 50 görsel içerebilir.')
    const source = new Image()
    source.crossOrigin = 'anonymous'
    source.src = node.getAttribute('src') || ''
    await Promise.race([
      source.decode(),
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(new Error('DOCX için görsel okunamadı. Görseli medya kütüphanesine yükleyin.')),
          8000,
        ),
      ),
    ])
    if (!source.naturalWidth || source.naturalWidth * source.naturalHeight > 16000000)
      throw new Error('DOCX görseli en fazla 16 megapiksel olabilir.')
    const canvas = document.createElement('canvas')
    canvas.width = source.naturalWidth
    canvas.height = source.naturalHeight
    canvas.getContext('2d').drawImage(source, 0, 0)
    const base64 = canvas.toDataURL('image/png').split(',')[1],
      binary = atob(base64),
      bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    totalBytes += bytes.length
    if (totalBytes > 30 * 1024 * 1024)
      throw new Error('DOCX görselleri toplam 30 MB sınırını aşıyor.')
    const name = `image${imageId}.png`
    files[`word/media/${name}`] = bytes
    const id = relation('image', `media/${name}`),
      width = Math.max(1, Math.min(parseFloat(node.style.width) || source.naturalWidth, 600)),
      height = (width * source.naturalHeight) / source.naturalWidth,
      cx = Math.round(width * 9525),
      cy = Math.round(height * 9525)
    return `<w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${imageId}" name="${name}" descr="${xml(node.alt || '')}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${imageId}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  }
  async function runs(node, format = '') {
    if (node.nodeType === 3)
      return node.data
        ? `<w:r><w:rPr>${format}</w:rPr><w:t xml:space="preserve">${xml(node.data)}</w:t></w:r>`
        : ''
    if (node.nodeType !== 1) return ''
    if (node.tagName === 'IMG') return image(node)
    if (node.tagName === 'BR') return '<w:r><w:br/></w:r>'
    if (['VIDEO', 'AUDIO'].includes(node.tagName))
      return `<w:r><w:t>${xml(node.tagName === 'VIDEO' ? '[Video]' : '[Audio]')}</w:t></w:r>`
    let style = format
    if (
      node.matches('b,strong') ||
      Number(node.style.fontWeight) >= 600 ||
      node.style.fontWeight === 'bold'
    )
      style += '<w:b/>'
    if (node.matches('i,em') || node.style.fontStyle === 'italic') style += '<w:i/>'
    if (node.matches('u') || node.style.textDecoration.includes('underline'))
      style += '<w:u w:val="single"/>'
    if (node.matches('s,strike,del')) style += '<w:strike/>'
    if (node.matches('code,pre')) style += '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>'
    const color = node.style.color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)
    if (color)
      style += `<w:color w:val="${color
        .slice(1)
        .map((v) => Number(v).toString(16).padStart(2, '0'))
        .join('')}"/>`
    if (node.style.fontSize.endsWith('px'))
      style += `<w:sz w:val="${Math.max(2, Math.min(200, Math.round(parseFloat(node.style.fontSize) * 1.5)))}"/>`
    const content = (
      await Promise.all([...node.childNodes].map((child) => runs(child, style)))
    ).join('')
    if (node.tagName === 'A' && /^(https?:|mailto:|tel:)/i.test(node.getAttribute('href') || ''))
      return `<w:hyperlink r:id="${relation('hyperlink', node.getAttribute('href'), true)}">${content}</w:hyperlink>`
    return content
  }
  async function paragraph(node, number = null, depth = 0) {
    let props = /^H[1-6]$/.test(node.tagName) ? `<w:pStyle w:val="Heading${node.tagName[1]}"/>` : ''
    if (node.style?.textAlign)
      props += `<w:jc w:val="${node.style.textAlign === 'justify' ? 'both' : node.style.textAlign}"/>`
    if (node.dir === 'rtl') props += '<w:bidi/>'
    if (number)
      props += `<w:numPr><w:ilvl w:val="${Math.min(8, depth)}"/><w:numId w:val="${number}"/></w:numPr>`
    return `<w:p><w:pPr>${props}</w:pPr>${await runs(node)}</w:p>`
  }
  async function blocks(parent, depth = 0) {
    let result = ''
    for (const node of parent.childNodes) {
      if (node.nodeType === 3) {
        if (node.data.trim()) result += await paragraph(node)
        continue
      }
      if (node.nodeType !== 1) continue
      if (node.hasAttribute('data-studio-page-break')) {
        result += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
        continue
      }
      if (node.matches('ul,ol')) {
        const num = numbers.length + 1
        const type = node.tagName === 'UL' ? 'bullet' : 'decimal'
        numbers.push({ num, type, start: Number(node.getAttribute('start')) || 1 })
        for (const item of node.children) {
          const copy = item.cloneNode(true)
          copy.querySelectorAll('ul,ol').forEach((n) => n.remove())
          result += await paragraph(copy, num, depth)
          for (const nested of item.children)
            if (nested.matches('ul,ol')) {
              const wrapper = doc.createElement('div')
              wrapper.append(nested.cloneNode(true))
              result += await blocks(wrapper, depth + 1)
            }
        }
      } else if (node.tagName === 'TABLE') {
        const grid = tableGrid(node)
        if (!grid)
          throw new Error('DOCX için tablo yapısını düzeltin; eksik veya çakışan hücre var.')
        let rows = ''
        for (let y = 0; y < grid.height; y++) {
          let cells = ''
          for (let x = 0; x < grid.width;) {
            const cell = grid.grid[y][x],
              p = grid.positions.get(cell)
            const props = `${p.w > 1 ? `<w:gridSpan w:val="${p.w}"/>` : ''}${p.h > 1 ? `<w:vMerge${y === p.y ? ' w:val="restart"' : ''}/>` : ''}`
            const content =
              y === p.y
                ? cell.querySelector('p,table,ul,ol,h1,h2,h3')
                  ? await blocks(cell)
                  : await paragraph(cell)
                : '<w:p/>'
            cells += `<w:tc><w:tcPr>${props}</w:tcPr>${content || '<w:p/>'}<w:p/></w:tc>`
            x += p.w
          }
          rows += `<w:tr>${node.rows[y]?.parentElement.tagName === 'THEAD' ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells}</w:tr>`
        }
        result += `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((side) => `<w:${side} w:val="single" w:sz="4" w:color="CBD5E1"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid>${Array(grid.width).fill('<w:gridCol w:w="2000"/>').join('')}</w:tblGrid>${rows}</w:tbl>`
      } else if (
        node.matches('div,blockquote,figure') &&
        node.querySelector('p,table,ul,ol,h1,h2,h3')
      )
        result += await blocks(node, depth)
      else result += await paragraph(node)
    }
    return result
  }
  const body = await blocks(doc.body)
  let section = ''
  for (const kind of ['header', 'footer'])
    if (settings[kind]) {
      files[`word/${kind}.xml`] = strToU8(
        wrap(
          kind === 'header' ? 'w:hdr' : 'w:ftr',
          `<w:p><w:r><w:t>${xml(settings[kind])}</w:t></w:r></w:p>`,
        ),
      )
      section += `<w:${kind}Reference w:type="default" r:id="${relation(kind, `${kind}.xml`)}"/>`
    }
  let [width, height] = settings.size === 'Letter' ? [12240, 15840] : [11906, 16838]
  if (settings.landscape) [width, height] = [height, width]
  const margin = Math.round(settings.margin * 56.6929)
  section += `<w:pgSz w:w="${width}" w:h="${height}"${settings.landscape ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="360" w:footer="360"/>`
  files['word/document.xml'] = strToU8(
    wrap('w:document', `<w:body>${body}<w:sectPr>${section}</w:sectPr></w:body>`),
  )
  files['word/styles.xml'] = strToU8(
    wrap(
      'w:styles',
      Array.from(
        { length: 6 },
        (_, i) =>
          `<w:style w:type="paragraph" w:styleId="Heading${i + 1}"><w:name w:val="heading ${i + 1}"/><w:pPr><w:keepNext/><w:outlineLvl w:val="${i}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${40 - i * 4}"/></w:rPr></w:style>`,
      ).join(''),
    ),
  )
  relation('styles', 'styles.xml')
  if (numbers.length) {
    files['word/numbering.xml'] = strToU8(
      wrap(
        'w:numbering',
        numbers
          .map(
            (n) =>
              `<w:abstractNum w:abstractNumId="${n.num}">${Array.from({ length: 9 }, (_, level) => `<w:lvl w:ilvl="${level}"><w:start w:val="${n.start}"/><w:numFmt w:val="${n.type}"/><w:lvlText w:val="${n.type === 'bullet' ? '•' : `%${level + 1}.`}"/><w:pPr><w:ind w:left="${720 * (level + 1)}" w:hanging="360"/></w:pPr></w:lvl>`).join('')}</w:abstractNum><w:num w:numId="${n.num}"><w:abstractNumId w:val="${n.num}"/></w:num>`,
          )
          .join(''),
      ),
    )
    relation('numbering', 'numbering.xml')
  }
  files['word/_rels/document.xml.rels'] = strToU8(
    `<?xml version="1.0"?><Relationships xmlns="${relationships}">${rels.join('')}</Relationships>`,
  )
  files['_rels/.rels'] = strToU8(
    `<?xml version="1.0"?><Relationships xmlns="${relationships}"><Relationship Id="rId1" Type="${office}/officeDocument" Target="word/document.xml"/></Relationships>`,
  )
  const parts = [
    [
      'document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
    ],
    ['styles', 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml'],
    ...(numbers.length
      ? [
          [
            'numbering',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml',
          ],
        ]
      : []),
    ...['header', 'footer']
      .filter((k) => settings[k])
      .map((k) => [k, `application/vnd.openxmlformats-officedocument.wordprocessingml.${k}+xml`]),
  ]
  files['[Content_Types].xml'] = strToU8(
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>${parts.map(([name, type]) => `<Override PartName="/word/${name}.xml" ContentType="${type}"/>`).join('')}</Types>`,
  )
  return new Blob([zipSync(files, { level: 6 })], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}
export async function downloadDocx(html, options) {
  const blob = await exportDocx(html, options),
    url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: 'studio-document.docx',
  })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
