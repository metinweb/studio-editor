/** Command policy, independent from toolbar layout and HTML sanitization. */
export const featureMethods = {
  formatting:
    'inline clearFormat block align blockStyle changeCase copyFormat applyFormat applyContentStyle typography penInput'.split(
      ' ',
    ),
  lists: 'list listProperties indent taskList toggleTask'.split(' '),
  tables:
    'insertTable table tableProperties tableSort tableAppearance mergeCells mergeCellRight mergeCellDown splitCell formatCells clearCells pasteCells beginTableResize previewTableResize beginColumnResize previewColumnResize'.split(
      ' ',
    ),
  media:
    'image replaceImageData removeImage beginImageResize previewImageResize insertEmbed updateEmbed removeEmbed'.split(
      ' ',
    ),
  links: 'link unlink autoLink setAnchor removeAnchor'.split(' '),
  review: 'addComment updateComment suggestText resolveSuggestion'.split(' '),
  history: ['undo', 'redo'],
}
export const featureNames = [
  ...Object.keys(featureMethods),
  'science',
  'source',
  'ai',
  'language',
  'pageEmbed',
  'uiElements',
]
export function featureEnabled(features, name) {
  return features?.[name] !== false
}
export function installFeaturePolicy(prototype) {
  for (const [feature, methods] of Object.entries(featureMethods)) {
    for (const method of methods) {
      const original = prototype[method]
      if (typeof original !== 'function') throw new Error(`Unknown feature command: ${method}`)
      prototype[method] = function (...args) {
        if (!featureEnabled(this.features, feature)) return false
        return original.apply(this, args)
      }
    }
  }
}
export const dialogFeatures = {
  ai: 'ai',
  language: 'language',
  science: 'science',
  table: 'tables',
  cellFormat: 'tables',
  formula: 'tables',
  image: 'media',
  imageEdit: 'media',
  embed: 'media',
  link: 'links',
  anchor: 'links',
  listProperties: 'lists',
  pen: 'formatting',
  pageEmbed: 'pageEmbed',
  uiElement: 'uiElements',
  cmsHistory: 'history',
}
export function menuFeature(label) {
  if (['Form oluşturucu', 'Slider oluşturucu', 'Akordeon oluşturucu'].includes(label))
    return 'uiElements'
  if (label === 'Web sayfası göm') return 'pageEmbed'
  if (label === 'CMS sürüm geçmişi') return 'history'
  if (/Tablo|tablo|Hücre|hücre|Satır|satır|Sütun|sütun/.test(label)) return 'tables'
  if (/Matematik ve kimya/.test(label)) return 'science'
  if (/AI yazım/.test(label)) return 'ai'
  if (/Yazım ve dil/.test(label)) return 'language'
  if (/HTML kaynak/.test(label)) return 'source'
  if (/Görsel|medya/.test(label)) return 'media'
  if (/Bağlantı|Çapa/.test(label)) return 'links'
  if (/yorum|öneri/.test(label)) return 'review'
  if (/Geri al|Yinele/.test(label)) return 'history'
  if (/liste|Liste|Girinti/.test(label)) return 'lists'
  if (
    /Kalın|İtalik|Altı çizili|Üstü çizili|biçim|Biçim|Hizala|harf|Metin rengi|Vurgu rengi/.test(
      label,
    )
  )
    return 'formatting'
  return null
}
