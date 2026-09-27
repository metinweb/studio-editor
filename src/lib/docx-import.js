import { cleanHtml } from './content'

import { validateDocxArchive } from './docx-container.js'

export async function importDocx(file) {
  if (!/\.docx$/i.test(file.name)) throw new Error('Geçerli bir DOCX dosyası seçin.')
  if (file.size > 10 * 1024 * 1024) throw new Error('DOCX dosyası en fazla 10 MB olabilir.')
  const arrayBuffer = await file.arrayBuffer()
  validateDocxArchive(arrayBuffer)
  const module = await import('mammoth/mammoth.browser.js')
  const mammoth = module.default || module
  let skippedImages = 0
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      externalFileAccess: false,
      includeEmbeddedStyleMap: false,
      styleMap: [
        'u => u',
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
      ],
      convertImage: mammoth.images.imgElement(async (image) => {
        if (!/^image\/(png|jpeg|gif|webp)$/.test(image.contentType)) {
          skippedImages++
          return { alt: 'Unsupported image' }
        }
        return { src: `data:${image.contentType};base64,${await image.read('base64')}` }
      }),
    },
  )
  const html = cleanHtml(result.value)
  if (!html.trim()) throw new Error('Bu dosyada içe aktarılacak içerik bulunamadı.')
  return { html, warnings: result.messages.map((item) => item.message), skippedImages }
}
