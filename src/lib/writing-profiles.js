import { normalizePen, normalizeWritingPreferences } from './writing-preferences.js'
const storageKey = 'studio.writing-profiles.v1'
export function parseWritingProfile(input) {
  if (
    !input ||
    input.schemaVersion !== 1 ||
    !['pen', 'correction'].includes(input.kind) ||
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.length > 80 ||
    !input.value ||
    typeof input.value !== 'object'
  )
    throw new Error('Geçerli bir yazma profili seçin.')
  const value =
    input.kind === 'pen' ? normalizePen(input.value) : normalizeWritingPreferences(input.value)
  if (
    input.kind === 'correction' &&
    (!Array.isArray(input.value.rules) || input.value.rules.length !== value.rules.length)
  )
    throw new Error('Geçerli bir yazma profili seçin.')
  return { schemaVersion: 1, kind: input.kind, name: input.name.trim(), value }
}
export function loadWritingProfiles(storage) {
  const raw = storage.getItem(storageKey)
  if (!raw) return []
  if (raw.length > 600000) throw new Error('Yazma profilleri okunamadı.')
  const data = JSON.parse(raw)
  if (!Array.isArray(data) || data.length > 20) throw new Error('Yazma profilleri okunamadı.')
  return data.map(parseWritingProfile)
}
export function saveWritingProfiles(storage, entries) {
  const normalized = entries.map(parseWritingProfile)
  const serialized = JSON.stringify(normalized)
  if (entries.length > 20 || serialized.length > 600000)
    throw new Error('En fazla 20 profil ve toplam 600.000 karakter saklanabilir.')
  storage.setItem(storageKey, serialized)
  return normalized
}
