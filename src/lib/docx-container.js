export function validateDocxArchive(buffer) {
  if (buffer.byteLength > 10 * 1024 * 1024 || buffer.byteLength < 22)
    throw new Error('DOCX dosyası en fazla 10 MB olabilir.')
  const view = new DataView(buffer)
  let end = buffer.byteLength - 22
  for (; end >= Math.max(0, buffer.byteLength - 65557); end--)
    if (
      view.getUint32(end, true) === 0x06054b50 &&
      end + 22 + view.getUint16(end + 20, true) === buffer.byteLength
    )
      break
  if (end < 0 || view.getUint32(end, true) !== 0x06054b50)
    throw new Error('Geçerli bir DOCX dosyası seçin.')
  const count = view.getUint16(end + 10, true)
  let offset = view.getUint32(end + 16, true),
    total = 0,
    document = false
  if (!count || count > 1000 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true))
    throw new Error('DOCX arşivi desteklenmiyor veya çok büyük.')
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error('Geçerli bir DOCX dosyası seçin.')
    const length = view.getUint16(offset + 28, true)
    const size = view.getUint32(offset + 24, true)
    total += size
    if (total > 40 * 1024 * 1024 || size > 20 * 1024 * 1024 || view.getUint16(offset + 8, true) & 1)
      throw new Error('DOCX arşivi desteklenmiyor veya çok büyük.')
    const next =
      offset + 46 + length + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
    if (next > end) throw new Error('Geçerli bir DOCX dosyası seçin.')
    const name = new TextDecoder().decode(new Uint8Array(buffer, offset + 46, length))
    if (name === 'word/document.xml') document = true
    offset = next
  }
  if (!document) throw new Error('Geçerli bir DOCX dosyası seçin.')
}
