self.onmessage = async ({ data }) => {
  const { bitmap, type, quality, adjustments } = data
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
      ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const { brightness = 100, contrast = 100, saturation = 100 } = adjustments
    if (brightness !== 100 || contrast !== 100 || saturation !== 100) {
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
        p = pixels.data
      for (let i = 0; i < p.length; i += 4) {
        const r = (((p[i] * brightness) / 100 - 128) * contrast) / 100 + 128,
          g = (((p[i + 1] * brightness) / 100 - 128) * contrast) / 100 + 128,
          b = (((p[i + 2] * brightness) / 100 - 128) * contrast) / 100 + 128,
          gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
        p[i] = gray + ((r - gray) * saturation) / 100
        p[i + 1] = gray + ((g - gray) * saturation) / 100
        p[i + 2] = gray + ((b - gray) * saturation) / 100
      }
      ctx.putImageData(pixels, 0, 0)
    }
    const blob = await canvas.convertToBlob({ type, quality })
    if (blob.type !== type) throw new Error('Bu tarayıcı seçili çıktı biçimini desteklemiyor.')
    self.postMessage({ blob })
  } catch (error) {
    bitmap.close()
    self.postMessage({ error: error.message })
  }
}
