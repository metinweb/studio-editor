<script setup>
import { useEditorLocale } from '../lib/editor-locale'
const { t, locale } = useEditorLocale()
import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue'
import {
  Crop,
  RotateCcw,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  Check,
  LoaderCircle,
  Image,
  SlidersHorizontal,
} from '@lucide/vue'
import AppDialog from './AppDialog.vue'
import { loadEditableImage, transformImage, renderImage, renderImageBlob } from '../lib/image-edit'

const props = defineProps({ src: String, alt: String, apply: Function })
const emit = defineEmits(['close'])
const source = shallowRef(null)
const transformed = shallowRef(null)
const preview = ref(null)
const stage = ref(null)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const rotation = ref(0)
const flipX = ref(false),
  flipY = ref(false)
const cropMode = ref(false),
  selecting = ref(false)
const ratio = ref('free')
const crop = reactive({ x: 0, y: 0, w: 1, h: 1 })
const adjustments = reactive({ brightness: 100, contrast: 100, saturation: 100 })
const outputWidth = ref(1)
const outputType = ref('image/png')
const quality = ref(90)
const controller = new AbortController()
onBeforeUnmount(() => controller.abort())
const compare = ref(false)
let alive = true,
  animation = 0,
  drag = null
const corners = ['nw', 'ne', 'sw', 'se']
const dimensions = computed(() => ({
  width: transformed.value?.width || 1,
  height: transformed.value?.height || 1,
}))
const outputHeight = computed(() =>
  Math.max(1, Math.round((Number(outputWidth.value) * crop.h) / crop.w)),
)
const cropStyle = computed(() => ({
  left: `${(100 * crop.x) / dimensions.value.width}%`,
  top: `${(100 * crop.y) / dimensions.value.height}%`,
  width: `${(100 * crop.w) / dimensions.value.width}%`,
  height: `${(100 * crop.h) / dimensions.value.height}%`,
}))
function schedule() {
  cancelAnimationFrame(animation)
  animation = requestAnimationFrame(draw)
}
function draw() {
  if (!preview.value || !transformed.value) return
  const base = compare.value ? source.value : transformed.value
  const width = Math.max(1, Math.min(base.width, 960, (960 * base.width) / base.height))
  const result = renderImage(
    base,
    { x: 0, y: 0, w: base.width, h: base.height },
    width,
    compare.value ? {} : adjustments,
  )
  preview.value.width = result.width
  preview.value.height = result.height
  preview.value.getContext('2d').drawImage(result, 0, 0)
}
function resetCrop() {
  Object.assign(crop, { x: 0, y: 0, w: dimensions.value.width, h: dimensions.value.height })
  outputWidth.value = crop.w
}
function rebuild() {
  if (!source.value) return
  transformed.value = transformImage(source.value, rotation.value, flipX.value, flipY.value)
  ratio.value = 'free'
  resetCrop()
  nextTick(schedule)
}
function reset() {
  rotation.value = 0
  flipX.value = false
  flipY.value = false
  Object.assign(adjustments, { brightness: 100, contrast: 100, saturation: 100 })
  compare.value = false
  cropMode.value = false
  rebuild()
}
function chooseRatio(value) {
  ratio.value = value
  cropMode.value = true
  if (value === 'free') return
  const r = Number(value)
  const w = Math.min(dimensions.value.width, dimensions.value.height * r)
  const h = w / r
  Object.assign(crop, {
    x: Math.round((dimensions.value.width - w) / 2),
    y: Math.round((dimensions.value.height - h) / 2),
    w: Math.round(w),
    h: Math.round(h),
  })
  outputWidth.value = crop.w
}
function point(event) {
  const rect = stage.value.getBoundingClientRect()
  return {
    x: Math.max(
      0,
      Math.min(
        dimensions.value.width - 1,
        ((event.clientX - rect.left) / rect.width) * dimensions.value.width,
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        dimensions.value.height - 1,
        ((event.clientY - rect.top) / rect.height) * dimensions.value.height,
      ),
    ),
  }
}
function begin(event, kind = 'draw') {
  if (!cropMode.value || compare.value || event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  drag = {
    start: point(event),
    initial: { ...crop },
    kind: selecting.value ? 'draw' : kind,
    pointer: event.pointerId,
  }
  selecting.value = false
  stage.value.setPointerCapture(event.pointerId)
}
function move(event) {
  if (!drag || drag.pointer !== event.pointerId) return
  const p = point(event),
    before = drag.initial
  if (drag.kind === 'move') {
    crop.x = Math.round(
      Math.max(0, Math.min(dimensions.value.width - crop.w, before.x + p.x - drag.start.x)),
    )
    crop.y = Math.round(
      Math.max(0, Math.min(dimensions.value.height - crop.h, before.y + p.y - drag.start.y)),
    )
    return
  }
  const origin =
    drag.kind === 'draw'
      ? drag.start
      : {
          x: drag.kind.includes('w') ? before.x + before.w : before.x,
          y: drag.kind.includes('n') ? before.y + before.h : before.y,
        }
  let w = Math.max(1, Math.abs(p.x - origin.x)),
    h = Math.max(1, Math.abs(p.y - origin.y))
  const sx = p.x >= origin.x ? 1 : -1,
    sy = p.y >= origin.y ? 1 : -1
  const maxW = sx > 0 ? dimensions.value.width - origin.x : origin.x
  const maxH = sy > 0 ? dimensions.value.height - origin.y : origin.y
  if (ratio.value !== 'free') {
    const r = Number(ratio.value)
    w = Math.min(Math.max(w, h * r), maxW, maxH * r)
    h = w / r
  }
  w = Math.max(1, Math.round(Math.min(w, Math.max(1, maxW))))
  h = Math.max(1, Math.round(Math.min(h, Math.max(1, maxH))))
  Object.assign(crop, {
    x: Math.round(sx > 0 ? origin.x : origin.x - w),
    y: Math.round(sy > 0 ? origin.y : origin.y - h),
    w,
    h,
  })
  outputWidth.value = w
}
function end(cancel = false) {
  if (!drag) return
  const previous = drag
  drag = null
  if (cancel) {
    Object.assign(crop, previous.initial)
    outputWidth.value = crop.w
  }
  if (stage.value?.hasPointerCapture(previous.pointer))
    stage.value.releasePointerCapture(previous.pointer)
}
function cropKey(event) {
  if (event.key === 'Escape' && drag) {
    event.preventDefault()
    event.stopPropagation()
    end(true)
    return
  }
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.preventDefault()
  const step = event.shiftKey ? 10 : 1
  crop.x = Math.max(
    0,
    Math.min(
      dimensions.value.width - crop.w,
      crop.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
    ),
  )
  crop.y = Math.max(
    0,
    Math.min(
      dimensions.value.height - crop.h,
      crop.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
    ),
  )
}
function preciseCrop(key, event) {
  const value = Math.round(Number(event.target.value))
  if (!Number.isFinite(value)) return
  ratio.value = 'free'
  crop[key] = Math.max(key === 'x' || key === 'y' ? 0 : 1, value)
  crop.x = Math.min(crop.x, dimensions.value.width - 1)
  crop.y = Math.min(crop.y, dimensions.value.height - 1)
  crop.w = Math.min(crop.w, dimensions.value.width - crop.x)
  crop.h = Math.min(crop.h, dimensions.value.height - crop.y)
  outputWidth.value = crop.w
}
async function save() {
  error.value = ''
  busy.value = true
  try {
    const output = await renderImageBlob(
      transformed.value,
      crop,
      Number(outputWidth.value),
      adjustments,
      outputType.value,
      quality.value / 100,
      controller.signal,
    )
    if (!alive) return
    await props.apply(output)
    if (alive) emit('close')
  } catch (cause) {
    if (alive) error.value = cause.message || 'Görsel kaydedilemedi.'
  } finally {
    busy.value = false
  }
}
watch([rotation, flipX, flipY], rebuild)
watch([adjustments, compare], schedule)
onMounted(async () => {
  try {
    const loaded = await loadEditableImage(props.src)
    if (!alive) return
    source.value = loaded
    rebuild()
  } catch (cause) {
    if (alive) error.value = cause.message || 'Bu görsel düzenlenemedi.'
  } finally {
    if (alive) {
      loading.value = false
      nextTick(schedule)
    }
  }
})
onBeforeUnmount(() => {
  alive = false
  cancelAnimationFrame(animation)
})
</script>

<template>
  <AppDialog
    class="image-editor-dialog"
    :title="t('Resim editörü')"
    wide
    @close="!busy && emit('close')"
  >
    <template #eyebrow
      ><span class="eyebrow"> {{ t('GÖRSELİ DÜZENLE') }} </span></template
    >
    <div v-if="loading" class="image-editor-loading">
      <LoaderCircle class="spin" :size="25" /> {{ t('Görsel hazırlanıyor…') }}
    </div>
    <div v-else-if="transformed" class="image-editor-layout" :aria-busy="busy" :inert="busy">
      <div class="image-editor-preview">
        <div class="image-edit-toolbar">
          <button :aria-pressed="cropMode" @click="cropMode = !cropMode">
            <Crop :size="17" /> {{ t('Kırp') }}
          </button>
          <span class="quick-separator" />
          <button
            :aria-label="t('Sola döndür')"
            :title="t('Sola 90° döndür')"
            @click="rotation = (rotation + 270) % 360"
          >
            <RotateCcw :size="18" />
          </button>
          <button
            :aria-label="t('Sağa döndür')"
            :title="t('Sağa 90° döndür')"
            @click="rotation = (rotation + 90) % 360"
          >
            <RotateCw :size="18" />
          </button>
          <button
            :aria-label="t('Yatay çevir')"
            :title="t('Yatay çevir')"
            :aria-pressed="flipX"
            @click="flipX = !flipX"
          >
            <FlipHorizontal2 :size="18" />
          </button>
          <button
            :aria-label="t('Dikey çevir')"
            :title="t('Dikey çevir')"
            :aria-pressed="flipY"
            @click="flipY = !flipY"
          >
            <FlipVertical2 :size="18" />
          </button>
          <button class="image-compare" :aria-pressed="compare" @click="compare = !compare">
            {{ compare ? t('Düzenlemeyi göster') : t('Orijinali göster') }}
          </button>
        </div>
        <div class="image-preview-well">
          <div
            ref="stage"
            class="image-edit-stage"
            :class="{ 'crop-active': cropMode, 'crop-selecting': selecting }"
            @pointerdown="begin($event)"
            @pointermove="move"
            @pointerup="end()"
            @pointercancel="end(true)"
            @lostpointercapture="end(true)"
            @keydown="cropKey"
          >
            <canvas
              ref="preview"
              :aria-label="compare ? t('Orijinal görsel') : t('Görsel düzenleme önizlemesi')"
              role="img"
            />
            <div
              v-if="cropMode && !compare"
              class="image-crop-box"
              :style="cropStyle"
              tabindex="0"
              :aria-label="t('Kırpma alanı; ok tuşlarıyla taşıyın')"
              @pointerdown="begin($event, 'move')"
            >
              <i /><i /><i /><i />
              <button
                v-for="corner in corners"
                :key="corner"
                :class="`crop-handle ${corner}`"
                :aria-label="`Kırpma köşesi ${corner}`"
                @pointerdown="begin($event, corner)"
              />
            </div>
          </div>
        </div>
        <div class="image-preview-caption">
          <Image :size="14" /><span
            >{{ dimensions.width }} × {{ dimensions.height }} {{ t('px') }}
          </span>
          <span>{{
            compare
              ? t('Orijinal')
              : cropMode
                ? `${crop.w} × ${crop.h} px seçili`
                : t('Canlı önizleme')
          }}</span>
        </div>
      </div>
      <aside class="image-adjustments">
        <h3><SlidersHorizontal :size="17" /> {{ t('Ayarlar') }}</h3>
        <template v-if="cropMode">
          <div class="image-adjust-section">
            <h4>{{ t('Kırpma oranı') }}</h4>
            <div class="crop-ratios">
              <button
                v-for="preset in [
                  { label: 'Serbest', value: 'free' },
                  { label: '1:1', value: '1' },
                  { label: '4:3', value: String(4 / 3) },
                  { label: '16:9', value: String(16 / 9) },
                ]"
                :key="preset.value"
                :aria-pressed="ratio === preset.value"
                @click="chooseRatio(preset.value)"
              >
                {{ preset.label }}
              </button>
            </div>
            <div class="crop-fields">
              <label
                v-for="field in [
                  { key: 'x', label: 'Sol' },
                  { key: 'y', label: 'Üst' },
                  { key: 'w', label: 'Genişlik' },
                  { key: 'h', label: 'Yükseklik' },
                ]"
                :key="field.key"
                >{{ field.label
                }}<input
                  type="number"
                  :aria-label="`Kırpma ${field.label.toLocaleLowerCase('tr')}`"
                  :value="crop[field.key]"
                  :min="['x', 'y'].includes(field.key) ? 0 : 1"
                  @change="preciseCrop(field.key, $event)"
              /></label>
            </div>
            <button class="text-button" @click="selecting = true">{{ t('Yeni alan çiz') }}</button
            ><button class="text-button" @click="resetCrop">{{ t('Kırpmayı sıfırla') }}</button>
          </div>
        </template>
        <div class="image-adjust-section">
          <label
            v-for="setting in [
              { key: 'brightness', label: 'Parlaklık' },
              { key: 'contrast', label: 'Kontrast' },
              { key: 'saturation', label: 'Doygunluk' },
            ]"
            :key="setting.key"
            class="image-slider"
          >
            <span
              >{{ t(setting.label) }}<output>{{ adjustments[setting.key] }}%</output></span
            >
            <input
              v-model.number="adjustments[setting.key]"
              type="range"
              min="0"
              max="200"
              :aria-label="t(setting.label)"
            />
          </label>
          <button
            class="image-grayscale"
            :aria-pressed="adjustments.saturation === 0"
            @click="adjustments.saturation = adjustments.saturation === 0 ? 100 : 0"
          >
            {{ t('Siyah beyaz') }}
          </button>
        </div>
        <div class="image-adjust-section">
          <h4>{{ t('Çıktı boyutu') }}</h4>
          <div class="image-output-size">
            <label>
              {{ t('Genişlik') }}
              <input
                v-model.number="outputWidth"
                :aria-label="t('Çıktı genişliği')"
                type="number"
                min="1"
                max="8192" /></label
            ><span>×</span
            ><label>
              {{ t('Yükseklik') }}
              <output :aria-label="t('Çıktı yüksekliği')">{{ outputHeight }}</output></label
            ><span> {{ t('px') }} </span>
          </div>
          <div class="image-output-formats">
            <button
              v-for="format in [
                { value: 'image/png', label: 'PNG' },
                { value: 'image/jpeg', label: 'JPEG' },
                { value: 'image/webp', label: 'WebP' },
              ]"
              :key="format.value"
              :aria-pressed="outputType === format.value"
              @click="outputType = format.value"
            >
              {{ format.label }}
            </button>
          </div>
          <label v-if="outputType !== 'image/png'" class="image-slider">
            <span
              >{{ t('Kalite') }}<output>{{ quality }}%</output></span
            >
            <input
              v-model.number="quality"
              type="range"
              min="10"
              max="100"
              :aria-label="t('Kalite')"
            />
          </label>
          <small
            >{{
              outputType !== 'image/jpeg'
                ? t('Şeffaflığı korur.')
                : t('Şeffaf alanlar beyaz olarak kaydedilir.')
            }}
            {{ t('Hareketli görseller tek kareye dönüşür.') }}
          </small>
        </div>
        <button class="image-reset" @click="reset">
          <RotateCcw :size="15" /> {{ t('Tüm ayarları sıfırla') }}
        </button>
      </aside>
    </div>
    <p v-if="error" class="error-banner image-edit-error" role="alert">{{ t(error) }}</p>
    <template #footer
      ><span class="image-save-note">
        {{ t('Düzenlenen görsel kütüphaneye yeni kopya olarak eklenir.') }}
      </span>
      <button class="button" :disabled="busy" @click="emit('close')">{{ t('Vazgeç') }}</button>
      <button class="button primary" :disabled="loading || busy || !transformed" @click="save">
        <LoaderCircle v-if="busy" :size="16" class="spin" /><Check v-else :size="16" />{{
          busy ? t('Kaydediliyor…') : t('Görseli uygula')
        }}
      </button>
    </template>
  </AppDialog>
</template>
