import ImageWorker from './image-worker.js?worker&inline'
const MAX_PIXELS = 16_000_000
export function canvasFor(width, height) {
  width = Math.round(width)
  height = Math.round(height)
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    width > 8192 ||
    height > 8192 ||
    width * height > MAX_PIXELS
  )
    throw new Error('Çıktı en fazla 8192 piksel kenar uzunluğu ve toplam 16 megapiksel olabilir.')
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}
export async function loadEditableImage(src) {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      image.src = ''
      reject(
        new Error(
          'Görsel zamanında yüklenemedi. Görseli medya kütüphanesine yükleyip tekrar deneyin.',
        ),
      )
    }, 15000)
    image.onload = () => {
      clearTimeout(timeout)
      resolve()
    }
    image.onerror = () => {
      clearTimeout(timeout)
      reject(
        new Error(
          'Görsel okunamadı. Harici sunucu düzenlemeye izin vermiyorsa görseli medya kütüphanesine yükleyin.',
        ),
      )
    }
    image.src = src
  })
  const canvas = canvasFor(image.naturalWidth, image.naturalHeight)
  canvas.getContext('2d').drawImage(image, 0, 0)
  canvas.getContext('2d').getImageData(0, 0, 1, 1)
  return canvas
}
export function transformImage(source, rotation, flipX, flipY) {
  const sideways = rotation % 180 !== 0
  const result = canvasFor(
    sideways ? source.height : source.width,
    sideways ? source.width : source.height,
  )
  const ctx = result.getContext('2d')
  ctx.translate(result.width / 2, result.height / 2)
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.drawImage(source, -source.width / 2, -source.height / 2)
  return result
}
export function adjustPixels(canvas, { brightness = 100, contrast = 100, saturation = 100 }) {
  if (brightness === 100 && contrast === 100 && saturation === 100) return canvas
  const context = canvas.getContext('2d')
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  const b = brightness / 100,
    c = contrast / 100,
    s = saturation / 100
  const p = pixels.data
  for (let i = 0; i < p.length; i += 4) {
    const r = (p[i] * b - 128) * c + 128
    const g = (p[i + 1] * b - 128) * c + 128
    const blue = (p[i + 2] * b - 128) * c + 128
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * blue
    p[i] = gray + (r - gray) * s
    p[i + 1] = gray + (g - gray) * s
    p[i + 2] = gray + (blue - gray) * s
  }
  context.putImageData(pixels, 0, 0)
  return canvas
}
export function renderImage(source, crop, width, adjustments, type = 'image/png') {
  const output = canvasFor(width, (width * crop.h) / crop.w)
  const context = output.getContext('2d')
  context.imageSmoothingQuality = 'high'
  if (type === 'image/jpeg') {
    context.fillStyle = '#fff'
    context.fillRect(0, 0, output.width, output.height)
  }
  context.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, output.width, output.height)
  return adjustPixels(output, adjustments)
}
export function imageBlob(canvas, type, quality = 0.92) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob && blob.type === type
          ? resolve(blob)
          : reject(new Error('Görsel kaydedilemedi. Daha küçük bir çıktı boyutu deneyin.')),
      type,
      Math.max(0.1, Math.min(1, quality)),
    ),
  )
}

export async function renderImageBlob(source, crop, width, adjustments, type, quality, signal) {
  const canvas = renderImage(source, crop, width, {}, type)
  if (signal?.aborted) throw new DOMException('İşlem iptal edildi.', 'AbortError')
  if (
    typeof Worker === 'undefined' ||
    typeof OffscreenCanvas === 'undefined' ||
    typeof createImageBitmap === 'undefined'
  ) {
    adjustPixels(canvas, adjustments)
    return {
      blob: await imageBlob(canvas, type, quality),
      width: canvas.width,
      height: canvas.height,
    }
  }
  const bitmap = await createImageBitmap(canvas)
  let worker
  try {
    worker = new ImageWorker()
  } catch {
    bitmap.close()
    adjustPixels(canvas, adjustments)
    return {
      blob: await imageBlob(canvas, type, quality),
      width: canvas.width,
      height: canvas.height,
    }
  }
  const blob = await new Promise((resolve, reject) => {
    const finish = (error, value) => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      worker.terminate()
      error ? reject(error) : resolve(value)
    }
    const abort = () => finish(new DOMException('İşlem iptal edildi.', 'AbortError'))
    const timer = setTimeout(() => finish(new Error('Görsel işleme zaman aşımına uğradı.')), 30000)
    worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.blob)
    worker.onerror = () => finish(new Error('Görsel işleyicisi başlatılamadı.'))
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) {
      bitmap.close()
      abort()
      return
    }
    worker.postMessage(
      {
        bitmap,
        type,
        quality: Math.max(0.1, Math.min(1, quality)),
        adjustments: { ...adjustments },
      },
      [bitmap],
    )
  })
  return { blob, width: canvas.width, height: canvas.height }
}
