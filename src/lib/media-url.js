export const acceptedTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'application/pdf',
]
export function safeMediaUrl(url) {
  if (typeof url !== 'string' || !url || /[\u0000-\u0020]/.test(url)) return false
  if (/^data:/i.test(url))
    return (
      acceptedTypes.includes(url.slice(5, url.indexOf(';')).toLowerCase()) &&
      /^data:[^;]+;base64,[a-z0-9+/=]+$/i.test(url)
    )
  try {
    return ['http:', 'https:'].includes(new URL(url, 'https://studio.invalid').protocol)
  } catch {
    return false
  }
}
