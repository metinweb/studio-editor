// Public identifiers remain independent of translated labels.
export const toolbarGroups = Object.freeze([
  'history',
  'typography',
  'format',
  'color',
  'align',
  'lists',
  'insert',
  'tools',
  'review',
])
export const menuNames = Object.freeze({
  file: 'Dosya',
  edit: 'Düzenle',
  view: 'Görünüm',
  insert: 'Ekle',
  format: 'Biçim',
  table: 'Tablo',
  tools: 'Araçlar',
})
export function includesOption(value, key) {
  return value !== false && (!Array.isArray(value) || value.includes(key))
}
