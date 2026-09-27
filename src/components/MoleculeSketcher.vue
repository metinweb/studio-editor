<script setup>
import { computed, ref, useId, onBeforeUnmount, nextTick } from 'vue'
import {
  MousePointer2,
  Pencil,
  Eraser,
  Undo2,
  Redo2,
  Crosshair,
  Plus,
  Trash2,
  Hexagon,
} from '@lucide/vue'
import { elements, bondLines, moleculePreset } from '../lib/science.js'
import {
  atomColors,
  atomLabel,
  cloneMolecule,
  closestAtom,
  snapBond,
  connectAtoms,
  addRing,
  centerMolecule,
  connectedAtoms,
  movableAtoms,
  translateAtoms,
} from '../lib/molecule-layout.js'
import { useEditorLocale } from '../lib/editor-locale'
import { resolveMoleculeText } from '../lib/molecule-catalog.js'
const { t } = useEditorLocale()
const props = defineProps({ modelValue: Object })
const emit = defineEmits(['update:modelValue'])
const tool = ref('move'),
  element = ref('C'),
  order = ref(1),
  selected = ref(-1)
const canvas = ref(null),
  undo = ref([]),
  redo = ref([]),
  gesture = ref(null),
  notice = ref('')
const graph = computed(() => props.modelValue)
const atom = computed(() => graph.value.atoms[selected.value])
const instructionId = useId()
const trayDrag = ref(null)
const textOpen = ref(false),
  textSource = ref(''),
  textMode = ref('auto'),
  textBusy = ref(false),
  textError = ref(''),
  textChoices = ref([])
let textRequest = 0
const protectedRing = computed(
  () => !!atom.value && movableAtoms(graph.value, selected.value).length > 1,
)
const textErrors = {
  'text-limit': '1–1000 karakterlik bir formül veya SMILES yazın.',
  'formula-needs-structure':
    'Bu formül tek bir yapıyı belirtmiyor. Molekül adını yazın veya SMILES modunu seçin.',
  'invalid-structure':
    'Yapı okunamadı. Formülü, SMILES yazımını ve atomların bağ sayılarını kontrol edin.',
  'unsupported-structure':
    'Bu çizim aracı yük, izotop, radikal ve stereokimya gösterimlerini henüz desteklemiyor.',
  'molecule-limit': 'Çizim en fazla 100 atom ve 150 bağ içerebilir.',
}
function toggleText() {
  textOpen.value = !textOpen.value
  textRequest++
  textBusy.value = false
}
function resetText() {
  textChoices.value = []
  textError.value = ''
}
function useTextExample(example) {
  textSource.value = example
  resetText()
}
async function fromText(smiles = null, tidy = false) {
  if (textBusy.value) return
  resetText()
  try {
    if (!tidy && smiles === null) {
      const result = resolveMoleculeText(textSource.value, textMode.value)
      if (result.choices) {
        textChoices.value = result.choices
        return
      }
      smiles = result.smiles
    }
  } catch (error) {
    textError.value = t(textErrors[error.message] || textErrors['invalid-structure'])
    return
  }
  cancelGesture()
  stopTray()
  const request = ++textRequest,
    before = JSON.stringify(graph.value)
  textBusy.value = true
  try {
    const converter = await import('../lib/molecule-text.js')
    if (request !== textRequest) return
    if (JSON.stringify(graph.value) !== before) throw new Error('drawing-changed')
    const result = tidy ? converter.tidyMolecule(graph.value) : converter.moleculeFromSmiles(smiles)
    update(result)
    selected.value = -1
    tool.value = 'move'
    textChoices.value = []
    await nextTick()
    if (window.matchMedia('(max-width: 680px)').matches)
      canvas.value?.scrollIntoView({ block: 'nearest' })
  } catch (error) {
    if (request === textRequest) {
      textError.value = t(
        error.message === 'drawing-changed'
          ? 'Çizim değişti. Tekrar deneyin.'
          : textErrors[error.message] || textErrors['invalid-structure'],
      )
      textOpen.value = true
    }
  } finally {
    if (request === textRequest) textBusy.value = false
  }
}
onBeforeUnmount(() => textRequest++)
const rings = [
  { id: 'ring5', label: 'Beşli halka', count: 5 },
  { id: 'ring6', label: 'Altılı halka', count: 6 },
  { id: 'ringB', label: 'Benzen halkası', count: 6 },
]
const dropGraph = computed(() => {
  const g = { atoms: [], bonds: [], skeletal: true }
  const d = trayDrag.value
  if (d?.inside && d.kind.startsWith('ring'))
    addRing(g, d.point, d.kind === 'ring5' ? 5 : 6, d.kind === 'ringB')
  return g
})
const tools = [
  { id: 'move', label: 'Taşı', icon: MousePointer2 },
  { id: 'bond', label: 'Bağ çiz', icon: Pencil },
  { id: 'atom', label: 'Atom ekle', icon: Plus },
  { id: 'erase', label: 'Sil', icon: Eraser },
]
const hint = computed(() =>
  tool.value === 'bond'
    ? 'Bir atomdan sürükleyerek zinciri uzatın. İki atoma tıklayarak da bağlayabilirsiniz.'
    : tool.value === 'move'
      ? 'Atomu taşıyın; molekülün tamamını taşımak için bir bağdan tutun.'
      : tool.value.startsWith('ring')
        ? 'Halka eklemek için boş alana tıklayın.'
        : tool.value === 'erase'
          ? 'Silmek için bir atoma veya bağa tıklayın.'
          : 'Boş alana tıklayarak atom ekleyin. Bir atoma tıklayarak elementini değiştirin.',
)
function checkpoint(before) {
  undo.value.push(before)
  if (undo.value.length > 60) undo.value.shift()
  redo.value = []
}
function update(next, record = true) {
  if (JSON.stringify(next) === JSON.stringify(graph.value)) return
  if (record) checkpoint(JSON.stringify(graph.value))
  emit('update:modelValue', next)
  notice.value = ''
}
function edit(callback) {
  const next = cloneMolecule(graph.value)
  callback(next)
  update(next)
}
function history(from, to) {
  if (gesture.value) {
    cancelGesture()
    return
  }
  if (!from.length) return
  to.push(JSON.stringify(graph.value))
  emit('update:modelValue', JSON.parse(from.pop()))
  selected.value = -1
}
function point(event) {
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
    canvas.value.getScreenCTM().inverse(),
  )
  return { x: Math.max(20, Math.min(580, p.x)), y: Math.max(20, Math.min(340, p.y)) }
}
function stopTray() {
  const d = trayDrag.value
  trayDrag.value = null
  if (d?.source.hasPointerCapture(d.pointer)) d.source.releasePointerCapture(d.pointer)
  window.removeEventListener('pointermove', moveTray)
  window.removeEventListener('pointerup', finishTray)
  window.removeEventListener('pointercancel', stopTray)
  window.removeEventListener('keydown', trayKey, true)
  window.removeEventListener('blur', stopTray)
}
function trayKey(event) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopImmediatePropagation()
  stopTray()
}
function startTray(event, kind) {
  if (event.button !== 0) return
  cancelGesture()
  stopTray()
  event.preventDefault()
  event.currentTarget.setPointerCapture(event.pointerId)
  trayDrag.value = {
    source: event.currentTarget,
    kind,
    pointer: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    inside: false,
  }
  window.addEventListener('pointermove', moveTray)
  window.addEventListener('pointerup', finishTray)
  window.addEventListener('pointercancel', stopTray)
  window.addEventListener('keydown', trayKey, true)
  window.addEventListener('blur', stopTray)
}
function moveTray(event) {
  const d = trayDrag.value
  if (!d || d.pointer !== event.pointerId) return
  d.x = event.clientX
  d.y = event.clientY
  if (Math.hypot(d.x - d.startX, d.y - d.startY) > 5) d.moved = true
  const rect = canvas.value.getBoundingClientRect()
  d.inside = d.x >= rect.left && d.x <= rect.right && d.y >= rect.top && d.y <= rect.bottom
  d.point = point(event)
  if (d.moved) event.preventDefault()
}
function finishTray(event) {
  if (trayDrag.value?.pointer !== event.pointerId) return
  moveTray(event)
  const d = trayDrag.value
  if (!d.moved) {
    if (d.kind.startsWith('ring')) chooseTool(d.kind)
    else palette(d.kind)
  }
  if (d.moved && d.inside) {
    if (d.kind.startsWith('ring')) placeRing(d.kind, d.point)
    else {
      const index = closestAtom(graph.value, d.point)
      element.value = d.kind
      if (index >= 0) {
        selected.value = index
        edit((g) => (g.atoms[index].element = d.kind))
      } else addAtom(d.point)
    }
    tool.value = 'move'
  }
  stopTray()
}
function trayClick(kind) {
  if (kind.startsWith('ring')) chooseTool(kind)
  else palette(kind)
}
function placeRing(kind, p) {
  const next = cloneMolecule(graph.value)
  if (addRing(next, p, kind === 'ring5' ? 5 : 6, kind === 'ringB')) update(next)
  else notice.value = t('Çizim sınırına ulaşıldı.')
  selected.value = -1
}
onBeforeUnmount(stopTray)
function addAtom(position) {
  if (graph.value.atoms.length >= 100) {
    notice.value = t('Çizim sınırına ulaşıldı.')
    return
  }
  const index = graph.value.atoms.length
  edit((g) => g.atoms.push({ ...position, element: element.value }))
  selected.value = index
}
function remove(index) {
  edit((g) => {
    g.atoms.splice(index, 1)
    g.bonds = g.bonds
      .filter((b) => b.a !== index && b.b !== index)
      .map((b) => ({ ...b, a: b.a > index ? b.a - 1 : b.a, b: b.b > index ? b.b - 1 : b.b }))
  })
  selected.value = -1
}
function chooseTool(id) {
  cancelGesture()
  tool.value = id
  selected.value = -1
}
function chooseOrder(n) {
  order.value = n
  chooseTool('bond')
}
function palette(e) {
  element.value = e
  if (atom.value) edit((g) => (g.atoms[selected.value].element = e))
}
function pick(index) {
  if (tool.value === 'erase') return remove(index)
  if (tool.value === 'atom') {
    selected.value = index
    edit((g) => (g.atoms[index].element = element.value))
    return
  }
  if (tool.value === 'bond' && selected.value >= 0 && selected.value !== index) {
    edit((g) => connectAtoms(g, selected.value, index, order.value))
    selected.value = -1
    return
  }
  selected.value = index
}
function begin(event, index = -1, forceMode = null, members = null) {
  if (event.button !== 0 || gesture.value) return
  const p = point(event)
  if (index < 0 && tool.value.startsWith('ring')) {
    placeRing(tool.value, p)
    return
  }
  if (tool.value === 'erase') {
    if (index >= 0) remove(index)
    return
  }
  if (tool.value === 'atom') {
    if (index >= 0) pick(index)
    else addAtom(p)
    return
  }
  if (tool.value !== 'bond' && tool.value !== 'move') {
    if (index >= 0) selected.value = index
    return
  }
  if (tool.value === 'move') selected.value = index
  gesture.value = {
    index,
    start: index >= 0 ? { ...graph.value.atoms[index] } : p,
    raw: p,
    end: p,
    target: -1,
    moved: false,
    before: JSON.stringify(graph.value),
    mode: forceMode || (tool.value === 'move' && index < 0 && !members ? 'bond' : tool.value),
    members:
      members ||
      (index >= 0 && tool.value === 'move' && forceMode !== 'bond'
        ? movableAtoms(graph.value, index)
        : null),
    pointer: event.pointerId,
  }
  canvas.value.setPointerCapture(event.pointerId)
  canvas.value.focus({ preventScroll: true })
  event.preventDefault()
}
function move(event) {
  const session = gesture.value
  if (!session || session.pointer !== event.pointerId) return
  const p = point(event)
  if (Math.hypot(p.x - session.raw.x, p.y - session.raw.y) > 5) session.moved = true
  if (!session.moved) return
  if (session.mode === 'move' && (session.index >= 0 || session.members)) {
    const next = JSON.parse(session.before)
    const indices = session.members || [session.index]
    translateAtoms(next, indices, p.x - session.raw.x, p.y - session.raw.y)
    update(next, false)
  } else if (session.mode === 'bond') {
    session.target = closestAtom(graph.value, p, session.index)
    session.end =
      session.target >= 0
        ? graph.value.atoms[session.target]
        : snapBond(session.start, p, !event.altKey)
  }
}
function releasePointer(session) {
  if (session && canvas.value?.hasPointerCapture(session.pointer))
    canvas.value.releasePointerCapture(session.pointer)
}
function finish(event) {
  if (!gesture.value || event.pointerId !== gesture.value.pointer) return
  move(event)
  const session = gesture.value
  gesture.value = null
  releasePointer(session)
  if (session.mode === 'move') {
    if (session.before !== JSON.stringify(graph.value)) checkpoint(session.before)
    return
  }
  if (!session.moved) {
    if (session.index >= 0) pick(session.index)
    else addAtom(session.start)
    return
  }
  const next = cloneMolecule(graph.value)
  const additions = (session.index < 0 ? 1 : 0) + (session.target < 0 ? 1 : 0)
  if (next.atoms.length + additions > 100 || next.bonds.length >= 150) {
    notice.value = t('Çizim sınırına ulaşıldı.')
    return
  }
  if (Math.hypot(session.end.x - session.start.x, session.end.y - session.start.y) < 12) return
  let a = session.index,
    b = session.target
  if (a < 0) {
    a = next.atoms.length
    next.atoms.push({ ...session.start, element: element.value })
  }
  if (b < 0) {
    b = next.atoms.length
    next.atoms.push({ x: session.end.x, y: session.end.y, element: element.value })
  }
  connectAtoms(next, a, b, order.value)
  update(next)
  selected.value = b
}
function cancelGesture() {
  const session = gesture.value
  if (!session) return
  gesture.value = null
  releasePointer(session)
  if (session.mode === 'move') emit('update:modelValue', JSON.parse(session.before))
}
function bondAction(index) {
  if (tool.value === 'erase') edit((g) => g.bonds.splice(index, 1))
  else if (tool.value === 'bond') edit((g) => (g.bonds[index].order = order.value))
}
function beginBond(event, index) {
  if (tool.value !== 'move') return bondAction(index)
  begin(event, -1, 'move', connectedAtoms(graph.value, graph.value.bonds[index].a))
}
function choosePreset(name) {
  cancelGesture()
  update(moleculePreset(name))
  selected.value = -1
}
function clear() {
  cancelGesture()
  update({ atoms: [], bonds: [], skeletal: graph.value.skeletal !== false })
  selected.value = -1
}
function changeAtom(key, value) {
  if (atom.value)
    edit((g) => {
      if (key === 'x' || key === 'y')
        translateAtoms(
          g,
          movableAtoms(g, selected.value),
          key === 'x' ? value - g.atoms[selected.value].x : 0,
          key === 'y' ? value - g.atoms[selected.value].y : 0,
        )
      else g.atoms[selected.value][key] = value
    })
}
function key(event) {
  if (event.target.closest('input,select,button')) return
  if (event.key === 'Escape' && gesture.value) {
    cancelGesture()
    event.preventDefault()
    event.stopPropagation()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.shiftKey ? history(redo.value, undo.value) : history(undo.value, redo.value)
    event.preventDefault()
    event.stopPropagation()
    return
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (['1', '2', '3'].includes(event.key)) chooseOrder(Number(event.key))
  else if (event.key.toLowerCase() === 'v') chooseTool('move')
  else if (event.key.toLowerCase() === 'b') chooseTool('bond')
  else if (event.key.toLowerCase() === 'e') chooseTool('erase')
  else if (['Delete', 'Backspace'].includes(event.key) && atom.value) remove(selected.value)
  else if (/^Arrow/.test(event.key) && atom.value) {
    const delta = event.shiftKey ? 10 : 2
    edit((g) => {
      translateAtoms(
        g,
        movableAtoms(g, selected.value),
        event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0,
        event.key === 'ArrowDown' ? delta : event.key === 'ArrowUp' ? -delta : 0,
      )
    })
  } else if (elements.includes(event.key.toUpperCase())) palette(event.key.toUpperCase())
  else return
  event.preventDefault()
  event.stopPropagation()
}
</script>
<template>
  <section class="molecule-editor" @keydown="key">
    <div class="molecule-heading">
      <div>
        <strong>{{ t('Molekül stüdyosu') }}</strong>
      </div>
      <div class="molecule-heading-actions">
        <button :aria-expanded="textOpen" @click="toggleText">{{ t('Metinden çiz') }}</button
        ><button :disabled="textBusy || !graph.atoms.length" @click="fromText(null, true)">
          {{ t('Yapıyı düzelt') }}
        </button>
      </div>
    </div>
    <div v-if="textOpen" class="molecule-text-panel">
      <label :for="instructionId + '-source'">{{ t('Formül, molekül adı veya SMILES') }}</label>
      <div class="molecule-text-row">
        <input
          :id="instructionId + '-source'"
          v-model="textSource"
          :disabled="textBusy"
          maxlength="1000"
          placeholder="CH₃CH₂OH · C₂H₆O · c1ccccc1"
          @input="resetText"
          @keydown.enter.prevent="fromText()"
        /><select
          v-model="textMode"
          :disabled="textBusy"
          :aria-label="t('Metin biçimi')"
          @change="resetText"
        >
          <option value="auto">{{ t('Otomatik') }}</option>
          <option value="smiles">SMILES</option></select
        ><button :disabled="textBusy" @click="fromText()">
          {{ t(textBusy ? 'Çiziliyor…' : 'Çizime dönüştür') }}
        </button>
      </div>
      <div class="molecule-text-examples">
        <button
          v-for="example in ['H₂O', 'CH₃CH₂OH', 'C₂H₆O', 'c1ccccc1']"
          :key="example"
          :disabled="textBusy"
          @click="useTextExample(example)"
        >
          {{ example }}
        </button>
      </div>
      <p>
        {{ t('Mevcut çizimin yerini alır; geri alınabilir. Karbona bağlı hidrojenler örtüktür.') }}
      </p>
      <div v-if="textChoices.length" class="molecule-text-choices">
        <p>
          {{
            t(
              'Formül bağ yapısını tek başına belirlemez. Yaygın yapılardan birini seçin; liste tüm izomerleri kapsamaz.',
            )
          }}
        </p>
        <button
          v-for="choice in textChoices"
          :key="choice.smiles"
          :disabled="textBusy"
          @click="fromText(choice.smiles)"
        >
          {{ t(choice.name) }} <code>{{ choice.smiles }}</code>
        </button>
      </div>
      <p v-if="textError" role="alert" class="molecule-text-error">{{ textError }}</p>
    </div>
    <div class="molecule-modebar" role="group" :aria-label="t('Çizim araçları')">
      <button
        v-for="item in tools"
        :key="item.id"
        :aria-label="t(item.label)"
        :aria-pressed="tool === item.id"
        @click="chooseTool(item.id)"
      >
        <component :is="item.icon" :size="17" /><span>{{ t(item.label) }}</span>
      </button>
    </div>
    <div class="molecule-topbar">
      <div class="molecule-elements" role="group" :aria-label="t('Element')">
        <button
          v-for="e in elements"
          :key="e"
          :style="{ '--atom-color': atomColors[e] }"
          :aria-label="t('Element {element}', { element: e })"
          :aria-pressed="element === e"
          class="molecule-draggable"
          :title="t('Tuvale sürükleyin veya seçili atomu değiştirmek için tıklayın.')"
          @pointerdown="startTray($event, e)"
          @click="$event.detail === 0 && trayClick(e)"
        >
          {{ e }}
        </button>
      </div>
      <div class="molecule-actions">
        <button
          :title="t('Çizimi geri al')"
          :aria-label="t('Çizimi geri al')"
          :disabled="!undo.length"
          @click="history(undo, redo)"
        >
          <Undo2 :size="17" />
        </button>
        <button
          :title="t('Çizimi yinele')"
          :aria-label="t('Çizimi yinele')"
          :disabled="!redo.length"
          @click="history(redo, undo)"
        >
          <Redo2 :size="17" />
        </button>
        <button
          :title="t('Çizimi ortala')"
          :aria-label="t('Çizimi ortala')"
          @click="edit(centerMolecule)"
        >
          <Crosshair :size="17" />
        </button>
        <button :title="t('Temizle')" :aria-label="t('Temizle')" @click="clear">
          <Trash2 :size="17" />
        </button>
      </div>
    </div>
    <div class="molecule-workbench">
      <div class="molecule-rail" role="group" :aria-label="t('Çizim araçları')">
        <button
          v-for="n in [1, 2, 3]"
          :key="n"
          :title="t(['Tek bağ', 'Çift bağ', 'Üçlü bağ'][n - 1])"
          :aria-label="t(['Tek bağ', 'Çift bağ', 'Üçlü bağ'][n - 1])"
          :aria-pressed="order === n && tool === 'bond'"
          @click="chooseOrder(n)"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <line
              v-for="i in n"
              :key="i"
              x1="4"
              :y1="12 + (i - (n + 1) / 2) * 5"
              x2="20"
              :y2="12 + (i - (n + 1) / 2) * 5"
              stroke="currentColor"
              stroke-width="1.7"
            />
          </svg>
        </button>
      </div>
      <div class="molecule-stage">
        <svg
          ref="canvas"
          class="molecule-canvas"
          :class="{
            'molecule-erasing': tool === 'erase',
            'molecule-moving': tool === 'move',
            'molecule-active-drag': !!gesture?.moved,
          }"
          viewBox="0 0 600 360"
          role="group"
          tabindex="0"
          :aria-label="t('Molekül çizim alanı')"
          :aria-describedby="instructionId"
          @pointerdown.self="begin($event)"
          @pointermove="move"
          @pointerup="finish"
          @pointercancel="cancelGesture"
          @lostpointercapture="cancelGesture"
        >
          <g
            v-for="(bond, index) in graph.bonds"
            :key="'b' + index"
            class="molecule-bond"
            role="button"
            tabindex="0"
            :aria-label="t('Bağ {a}–{b}', { a: bond.a + 1, b: bond.b + 1 })"
            @pointerdown.stop="beginBond($event, index)"
            @keydown.enter.stop.prevent="bondAction(index)"
            @keydown.delete.stop.prevent="edit((g) => g.bonds.splice(index, 1))"
          >
            <line
              class="molecule-bond-hit"
              :x1="graph.atoms[bond.a].x"
              :y1="graph.atoms[bond.a].y"
              :x2="graph.atoms[bond.b].x"
              :y2="graph.atoms[bond.b].y"
            />
            <line
              v-for="(line, i) in bondLines(graph, bond)"
              :key="i"
              class="molecule-bond-ink"
              v-bind="line"
            />
          </g>
          <g
            v-if="gesture?.mode === 'bond' && gesture.moved"
            class="molecule-ghost"
            pointer-events="none"
          >
            <line
              :x1="gesture.start.x"
              :y1="gesture.start.y"
              :x2="gesture.end.x"
              :y2="gesture.end.y"
            />
            <circle :cx="gesture.end.x" :cy="gesture.end.y" r="10" />
          </g>
          <g
            v-for="(a, index) in graph.atoms"
            :key="index"
            class="molecule-atom"
            :class="{ selected: selected === index, target: gesture?.target === index }"
            role="button"
            tabindex="0"
            :aria-label="t('Atom {n}: {element}', { n: index + 1, element: a.element })"
            :aria-pressed="selected === index"
            @pointerdown.stop="begin($event, index)"
            @keydown.enter.stop.prevent="pick(index)"
            @keydown.space.stop.prevent="pick(index)"
            @keydown.delete.stop.prevent="remove(index)"
          >
            <circle class="molecule-atom-hit" :cx="a.x" :cy="a.y" r="20" />
            <text
              v-if="atomLabel(graph, index)"
              :x="a.x"
              :y="a.y + 6.5"
              :fill="atomColors[a.element]"
              text-anchor="middle"
              font-size="20"
              font-weight="500"
            >
              {{ atomLabel(graph, index) }}
            </text>
            <circle v-else class="molecule-carbon-point" :cx="a.x" :cy="a.y" r="2.5" />
          </g>
          <g
            v-if="atom && tool === 'move' && !gesture"
            class="molecule-branch"
            role="button"
            tabindex="0"
            :aria-label="t('Seçili atomdan bağ çiz')"
            @pointerdown.stop="begin($event, selected, 'bond')"
            @keydown.enter.stop.prevent="tool = 'bond'"
          >
            <circle :cx="atom.x + (atom.x > 530 ? -32 : 32)" :cy="atom.y" r="11" />
            <path
              :d="`M ${atom.x + (atom.x > 530 ? -32 : 32) - 4} ${atom.y} h 8 M ${atom.x + (atom.x > 530 ? -32 : 32)} ${atom.y - 4} v 8`"
            />
          </g>
          <g
            v-if="trayDrag?.inside && trayDrag.moved"
            class="molecule-drop-preview"
            pointer-events="none"
          >
            <template v-if="dropGraph.atoms.length">
              <g v-for="(b, i) in dropGraph.bonds" :key="i">
                <line v-for="(line, j) in bondLines(dropGraph, b)" :key="j" v-bind="line" />
              </g>
            </template>
            <g v-else>
              <circle :cx="trayDrag.point.x" :cy="trayDrag.point.y" r="20" />
              <text :x="trayDrag.point.x" :y="trayDrag.point.y + 6" text-anchor="middle">
                {{ trayDrag.kind }}
              </text>
            </g>
          </g>
        </svg>
        <div v-if="!graph.atoms.length" class="molecule-empty" aria-hidden="true">
          <Hexagon :size="34" /><strong>{{ t('İlk bağı çizerek başlayın') }}</strong
          ><span>{{ t('Boş alanda sürükleyin veya bir şablon seçin.') }}</span>
        </div>
        <div class="molecule-canvas-status">
          <span>{{
            t('{atoms} atom · {bonds} bağ', {
              atoms: graph.atoms.length,
              bonds: graph.bonds.length,
            })
          }}</span
          ><label
            ><input
              type="checkbox"
              :checked="!!graph.skeletal"
              @change="edit((g) => (g.skeletal = $event.target.checked))"
            />{{ t('Karbon iskeleti') }}</label
          >
        </div>
      </div>
      <aside class="molecule-inspector">
        <span class="molecule-section-title">{{ t('Sürükle ve bırak') }}</span>
        <p class="molecule-tray-help">
          {{ t('Halkayı tuvale bırakın. Atomları üstteki paletten sürükleyin.') }}
        </p>
        <div class="molecule-ring-tray">
          <button
            v-for="r in rings"
            :key="r.id"
            class="molecule-draggable"
            :aria-label="t(r.label)"
            :aria-pressed="tool === r.id"
            @pointerdown="startTray($event, r.id)"
            @click="$event.detail === 0 && trayClick(r.id)"
          >
            <svg viewBox="0 0 64 56" aria-hidden="true">
              <path v-if="r.count === 5" d="M32 5 55 22 46 49 18 49 9 22Z" />
              <path v-else d="M20 7h24l12 21-12 21H20L8 28Z" />
              <circle v-if="r.id === 'ringB'" cx="32" cy="28" r="13" /></svg
            ><span>{{ r.id === 'ringB' ? t('Benzen') : r.count + ' ' + t('Halka') }}</span>
          </button>
        </div>
        <span class="molecule-section-title">{{ t('Başlangıç yapıları') }}</span>
        <div class="molecule-presets">
          <button
            v-for="p in [
              ['water', 'Su', 'H₂O'],
              ['ethanol', 'Etanol', 'C₂H₆O'],
              ['benzene', 'Benzen', 'C₆H₆'],
            ]"
            :key="p[0]"
            :aria-label="t(p[1])"
            @click="choosePreset(p[0])"
          >
            <strong>{{ p[2] }}</strong
            ><span>{{ t(p[1]) }}</span>
          </button>
        </div>
        <div v-if="atom" class="molecule-properties">
          <p v-if="protectedRing" class="molecule-ring-lock">
            {{ t('Halka şekli korunur. Taşıma tüm bağlı yapıya uygulanır.') }}
          </p>
          <span class="molecule-section-title">{{
            atom ? t('Seçili atom') + ' ' + (selected + 1) : t('Atom özellikleri')
          }}</span>
          <template v-if="atom"
            ><label
              >{{ t('Atom elementi')
              }}<select
                :aria-label="t('Atom elementi')"
                :value="atom.element"
                @change="changeAtom('element', $event.target.value)"
              >
                <option v-for="e in elements" :key="e">{{ e }}</option>
              </select></label
            >
            <div class="molecule-coordinates">
              <label
                >X<input
                  type="number"
                  min="20"
                  max="580"
                  :value="Math.round(atom.x)"
                  @change="
                    changeAtom('x', Math.max(20, Math.min(580, Number($event.target.value) || 20)))
                  " /></label
              ><label
                >Y<input
                  type="number"
                  min="20"
                  max="340"
                  :value="Math.round(atom.y)"
                  @change="
                    changeAtom('y', Math.max(20, Math.min(340, Number($event.target.value) || 20)))
                  "
              /></label>
            </div>
            <button class="molecule-delete-atom" @click="remove(selected)">
              <Trash2 :size="14" />{{ t('Atomu sil') }}
            </button></template
          >
          <p v-else>{{ t('Elementini veya konumunu değiştirmek için bir atom seçin.') }}</p>
        </div>
        <button class="molecule-keyboard-add" @click="addAtom({ x: 300, y: 180 })">
          <Plus :size="14" />{{ t('Merkeze atom ekle') }}
        </button>
      </aside>
    </div>
    <div :id="instructionId" class="molecule-hint">
      <span>{{ t(hint) }}</span
      ><kbd>{{ t('Alt: serbest açı') }}</kbd>
    </div>
    <p v-if="notice" role="status" class="science-help">{{ notice }}</p>
    <div
      v-if="trayDrag?.moved && !trayDrag.inside"
      class="molecule-drag-badge"
      :style="{ left: trayDrag.x + 'px', top: trayDrag.y + 'px' }"
    >
      {{ trayDrag.kind.startsWith('ring') ? '⬡' : trayDrag.kind }}
    </div>
  </section>
</template>
<style>
.molecule-editor {
  border: 1px solid #dce3ed;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  color: #27364c;
}
.molecule-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px 12px;
  background: linear-gradient(120deg, #f7f9ff, #fff);
}
.molecule-heading-actions {
  display: flex;
  gap: 6px;
}
.molecule-editor .molecule-heading-actions button {
  border: 1px solid #dbe2f1;
  border-radius: 8px;
  background: white;
  padding: 7px 10px;
  font-size: 11px;
  color: #5064c8;
}
.molecule-text-panel {
  padding: 12px 16px;
  background: #f7f9ff;
  border-top: 1px solid #e5eaf1;
  border-bottom: 1px solid #e5eaf1;
}
.molecule-text-panel > label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 7px;
}
.molecule-text-row {
  display: flex;
  gap: 6px;
}
.molecule-text-row input {
  flex: 1;
  min-width: 0;
}
.molecule-text-row input,
.molecule-text-row select {
  border: 1px solid #d8dfea;
  border-radius: 7px;
  background: white;
  padding: 9px;
  color: #27364c;
  font: inherit;
  font-size: 12px;
}
.molecule-editor .molecule-text-row button {
  background: #5364d9;
  color: white;
  border-radius: 7px;
  padding: 8px 12px;
  font-size: 12px;
}
.molecule-text-panel p {
  font-size: 11px;
  line-height: 1.5;
  margin: 8px 0 0;
  color: #73829c;
}
.molecule-text-examples {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.molecule-editor .molecule-text-examples button,
.molecule-editor .molecule-text-choices button {
  font-size: 11px;
  padding: 5px 9px;
  border-radius: 6px;
  border: 1px solid #dce3ef;
  background: white;
}
.molecule-editor .molecule-text-choices button {
  margin: 8px 6px 0 0;
  color: #4c60b7;
}
.molecule-text-choices code {
  margin-left: 8px;
  color: #7a88a4;
}
.molecule-text-panel .molecule-text-error {
  color: #b13b4f;
}
.molecule-properties .molecule-ring-lock {
  color: #526aaf;
  background: #eef2ff;
  border-radius: 6px;
  padding: 7px;
}
.molecule-heading strong {
  display: block;
  font-size: 18px;
  letter-spacing: -0.5px;
  color: #202d45;
}
.molecule-heading span {
  display: block;
  color: #8190a7;
  font-size: 12px;
  margin-top: 4px;
}
.molecule-heading .molecule-live-dot {
  font-size: 10px;
  border: 1px solid #dce8e5;
  background: #f1faf6;
  color: #37866b;
  border-radius: 20px;
  padding: 6px 10px;
}
.molecule-modebar {
  display: flex;
  gap: 6px;
  padding: 4px 16px 12px;
  background: #fff;
}
.molecule-modebar button {
  display: flex;
  align-items: center;
  gap: 7px;
  border-radius: 9px;
  padding: 9px 14px;
  color: #64748b;
  font-size: 12px;
}
.molecule-modebar button[aria-pressed='true'] {
  color: #fff;
  background: #5364d9;
  box-shadow: 0 3px 9px #5364d92a;
}
.molecule-draggable {
  touch-action: none;
  user-select: none;
  cursor: grab !important;
}
.molecule-draggable:active {
  cursor: grabbing !important;
}
.molecule-drag-badge {
  position: fixed;
  z-index: 100000;
  transform: translate(-50%, -50%);
  pointer-events: none;
  border: 2px solid #6877df;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 8px 24px #22335533;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  font: 600 23px Arial;
  color: #5364d9;
}
.molecule-editor button {
  font: inherit;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
}
.molecule-editor button:disabled {
  opacity: 0.35;
  cursor: default;
}
.molecule-editor button:focus-visible,
.molecule-editor input:focus-visible,
.molecule-editor select:focus-visible {
  outline: 2px solid #7960c7;
  outline-offset: 2px;
}
.molecule-topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #e5eaf1;
}
.molecule-elements,
.molecule-actions {
  display: flex;
  gap: 3px;
}
.molecule-elements button {
  width: 34px;
  height: 34px;
  border-radius: 7px;
  color: var(--atom-color);
  font-size: 16px;
  font-weight: 650;
}
.molecule-editor button:hover {
  background: #f0f3f8;
}
.molecule-elements button[aria-pressed='true'] {
  background: #edf2fc;
  border-color: #a9bad9;
}
.molecule-actions button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
}
.molecule-workbench {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 200px;
}
.molecule-rail {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 8px 4px;
  gap: 2px;
  background: #fff;
  border: 1px solid #e5eaf1;
  border-radius: 10px;
  box-shadow: 0 3px 12px #2636570d;
}
.molecule-rail button {
  display: grid;
  place-items: center;
  width: 35px;
  height: 33px;
  border-radius: 6px;
}
.molecule-rail button[aria-pressed='true'] {
  color: #6543ac;
  background: #ece6f9;
  border-color: #cbbbea;
}
.molecule-divider {
  width: 24px;
  border-top: 1px solid #dce3ed;
  margin: 5px 0;
}
.molecule-stage {
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: radial-gradient(#e0e6ef 0.8px, transparent 0.8px) 0 0 / 18px 18px #fff;
}
.molecule-stage .molecule-canvas {
  width: 100%;
  height: 360px;
  max-width: none;
  flex: none;
  min-height: 280px;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  touch-action: none;
  user-select: none;
  font-family: Arial, sans-serif;
  cursor: crosshair;
  display: block;
}
.molecule-canvas .molecule-atom-hit {
  fill: transparent;
  stroke: transparent;
  stroke-width: 1;
}
.molecule-canvas .molecule-atom:hover .molecule-atom-hit,
.molecule-canvas .molecule-atom:focus .molecule-atom-hit,
.molecule-canvas .molecule-atom.selected .molecule-atom-hit,
.molecule-canvas .molecule-atom.target .molecule-atom-hit {
  fill: #ece6fa88;
  stroke: #aa94ce;
}
.molecule-carbon-point {
  fill: #6f51ac;
  opacity: 0;
}
.molecule-moving .molecule-carbon-point {
  opacity: 0.65;
  fill: #97a7c4;
}
.molecule-canvas.molecule-moving [role='button'] {
  cursor: grab;
}
.molecule-canvas.molecule-active-drag,
.molecule-canvas.molecule-active-drag [role='button'] {
  cursor: grabbing;
}
.molecule-canvas .molecule-branch {
  cursor: crosshair !important;
}
.molecule-branch circle {
  fill: #5364d9;
  stroke: white;
  stroke-width: 2;
}
.molecule-branch path {
  fill: none;
  stroke: #fff;
  stroke-width: 1.7;
  pointer-events: none;
}
.molecule-drop-preview {
  stroke: #6377de;
  stroke-width: 2;
  fill: #eef1ff;
  opacity: 0.8;
}
.molecule-drop-preview text {
  stroke: none;
  fill: #5364d9;
  font-size: 20px;
}
.molecule-atom:hover .molecule-carbon-point,
.molecule-atom.selected .molecule-carbon-point,
.molecule-atom:focus .molecule-carbon-point {
  opacity: 1;
}
.molecule-canvas .molecule-bond-hit {
  stroke: transparent;
  stroke-width: 16;
}
.molecule-canvas .molecule-bond-ink {
  stroke: #243247;
  stroke-width: 1.9;
  stroke-linecap: round;
  pointer-events: none;
}
.molecule-canvas .molecule-bond:hover .molecule-bond-ink,
.molecule-canvas .molecule-bond:focus .molecule-bond-ink {
  stroke: #8463bd;
  stroke-width: 2.6;
}
.molecule-canvas .molecule-bond:focus .molecule-bond-hit {
  stroke: transparent;
}
.molecule-canvas.molecule-erasing .molecule-atom:hover .molecule-atom-hit {
  fill: #ffdfdf;
  stroke: #d65555;
}
.molecule-canvas .molecule-ghost line {
  stroke: #9276c5;
  stroke-width: 2;
  stroke-dasharray: 4 3;
}
.molecule-ghost circle {
  stroke: #9276c5;
  fill: #f4effc;
}
.molecule-canvas [role='button'] {
  outline: none;
  cursor: pointer;
}
.molecule-canvas text {
  pointer-events: none;
}
.molecule-empty {
  position: absolute;
  inset: 85px 15px auto;
  display: grid;
  justify-items: center;
  gap: 8px;
  color: #92a0b3;
  pointer-events: none;
  font-size: 12px;
}
.molecule-empty strong {
  font-size: 15px;
  font-weight: 500;
  color: #62738a;
}
.molecule-canvas-status {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  align-items: center;
  padding: 8px 12px;
  font-size: 11px;
  color: #697b90;
  background: #ffffffed;
  border-top: 1px solid #eff2f7;
}
.molecule-canvas-status label {
  display: flex;
  align-items: center;
  gap: 5px;
}
.molecule-inspector {
  height: 400px;
  box-sizing: border-box;
  overflow: auto;
  padding: 14px 12px;
  background: #f8fafc;
  border-left: 1px solid #e5eaf1;
}
.molecule-tray-help {
  font-size: 11px;
  line-height: 1.5;
  color: #8290a5;
  margin: -3px 0 12px;
}
.molecule-ring-tray {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
  margin-bottom: 20px;
}
.molecule-ring-tray button {
  min-width: 0;
  background: #fff;
  border: 1px solid #dfe5f0;
  border-radius: 10px;
  padding: 6px 3px;
}
.molecule-ring-tray button[aria-pressed='true'] {
  border-color: #7080dc;
  background: #eff2ff;
}
.molecule-ring-tray svg {
  width: 100%;
  height: 44px;
  fill: none;
  stroke: #4a5c7a;
  stroke-width: 2;
}
.molecule-ring-tray span {
  display: block;
  font-size: 9px;
  line-height: 1.4;
  color: #687b98;
}
.molecule-section-title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #74849a;
  font-weight: 650;
  display: block;
  margin-bottom: 10px;
}
.molecule-presets {
  display: grid;
  gap: 6px;
}
.molecule-presets button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #e1e7ef;
  border-radius: 7px;
  padding: 8px;
  background: white;
  font-size: 11px;
}
.molecule-presets strong {
  font-size: 13px;
  font-weight: 500;
}
.molecule-properties {
  margin-top: 12px;
  min-height: 0;
  font-size: 11px;
}
.molecule-properties p {
  color: #7b8a9e;
  line-height: 1.7;
}
.molecule-properties label {
  display: grid;
  gap: 5px;
}
.molecule-properties input,
.molecule-properties select {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  border: 1px solid #dce3ed;
  border-radius: 5px;
  background: white;
  padding: 5px;
  color: #27364c;
}
.molecule-coordinates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}
.molecule-editor .molecule-delete-atom {
  color: #b34747;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  padding: 4px 0;
}
.molecule-keyboard-add {
  display: flex;
  gap: 5px;
  align-items: center;
  font-size: 10px !important;
  padding: 5px 0;
}
.molecule-hint {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  background: #f5f7fb;
  border-top: 1px solid #e5eaf1;
  padding: 10px 12px;
  font-size: 11px;
  color: #687a91;
  line-height: 1.5;
}
.molecule-hint kbd {
  white-space: nowrap;
  font-family: inherit;
  color: #8c98aa;
}
@media (max-width: 680px) {
  .molecule-heading {
    flex-wrap: wrap;
    gap: 8px;
  }
  .molecule-text-row {
    flex-wrap: wrap;
  }
  .molecule-text-row input {
    flex-basis: 100%;
  }
  .molecule-text-row select {
    flex: 1;
  }
  .molecule-heading {
    padding: 14px 12px 10px;
  }
  .molecule-heading .molecule-live-dot {
    display: none;
  }
  .molecule-modebar {
    gap: 3px;
    padding: 3px 8px 10px;
  }
  .molecule-modebar button {
    flex: 1;
    justify-content: center;
    padding: 9px 4px;
    gap: 4px;
    font-size: 10px;
  }
  .molecule-workbench {
    display: flex;
    flex-direction: column;
  }
  .molecule-inspector {
    display: contents;
  }
  .molecule-stage {
    order: 2;
  }
  .molecule-rail {
    top: 82px;
  }
  .molecule-inspector > .molecule-section-title {
    display: none;
  }
  .molecule-tray-help {
    display: none;
  }
  .molecule-ring-tray {
    order: 1;
    margin: 0;
    padding: 8px;
    background: #f7f9fc;
  }
  .molecule-ring-tray button {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .molecule-ring-tray svg {
    width: 36px;
    flex: none;
  }
  .molecule-properties {
    order: 3;
    margin: 12px;
    min-height: 0;
  }
  .molecule-presets {
    order: 3;
    display: flex;
    margin: 8px;
    gap: 4px;
    align-content: start;
  }
  .molecule-presets button {
    flex: 1;
    gap: 4px;
    font-size: 10px;
  }
  .molecule-keyboard-add {
    order: 3;
    margin: 8px;
  }
  .molecule-stage .molecule-canvas {
    height: 260px;
    min-height: 240px;
  }
  .molecule-rail button {
    width: 30px;
  }
  .molecule-topbar {
    padding: 8px;
  }
  .molecule-elements {
    display: grid;
    grid-template-columns: repeat(10, minmax(0, 1fr));
    width: 100%;
    gap: 0;
  }
  .molecule-elements button {
    width: 100%;
    height: 34px;
    padding: 0;
    font-size: 14px;
  }
  .molecule-actions {
    margin-left: auto;
  }
  .molecule-hint kbd {
    display: none;
  }
}
</style>
