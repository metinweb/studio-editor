<script setup>
import { computed, ref, useId } from 'vue'
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
  Pentagon,
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
} from '../lib/molecule-layout.js'
import { useEditorLocale } from '../lib/editor-locale'
const { t } = useEditorLocale()
const props = defineProps({ modelValue: Object })
const emit = defineEmits(['update:modelValue'])
const tool = ref('bond'),
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
const tools = [
  { id: 'bond', label: 'Bağ çiz', icon: Pencil },
  { id: 'atom', label: 'Atom ekle', icon: Plus },
  { id: 'move', label: 'Taşı', icon: MousePointer2 },
  { id: 'erase', label: 'Sil', icon: Eraser },
]
const hint = computed(() =>
  tool.value === 'bond'
    ? 'Bir atomdan sürükleyerek zinciri uzatın. İki atoma tıklayarak da bağlayabilirsiniz.'
    : tool.value === 'move'
      ? 'Atomları sürükleyin. Ok tuşlarıyla hassas taşıyın.'
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
function begin(event, index = -1) {
  if (event.button !== 0 || gesture.value) return
  const p = point(event)
  if (index < 0 && tool.value.startsWith('ring')) {
    const next = cloneMolecule(graph.value)
    if (addRing(next, p, tool.value === 'ring5' ? 5 : 6, tool.value === 'ringB')) update(next)
    else notice.value = t('Çizim sınırına ulaşıldı.')
    selected.value = -1
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
    mode: tool.value,
    pointer: event.pointerId,
  }
  canvas.value.setPointerCapture(event.pointerId)
  event.preventDefault()
}
function move(event) {
  const session = gesture.value
  if (!session || session.pointer !== event.pointerId) return
  const p = point(event)
  if (Math.hypot(p.x - session.raw.x, p.y - session.raw.y) > 5) session.moved = true
  if (!session.moved) return
  if (session.mode === 'move' && session.index >= 0) {
    const next = cloneMolecule(graph.value)
    Object.assign(next.atoms[session.index], p)
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
      g.atoms[selected.value][key] = value
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
      const a = g.atoms[selected.value]
      a.x = Math.max(
        20,
        Math.min(
          580,
          a.x + (event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0),
        ),
      )
      a.y = Math.max(
        20,
        Math.min(
          340,
          a.y + (event.key === 'ArrowDown' ? delta : event.key === 'ArrowUp' ? -delta : 0),
        ),
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
    <div class="molecule-topbar">
      <div class="molecule-elements" role="group" :aria-label="t('Element')">
        <button
          v-for="e in elements"
          :key="e"
          :style="{ '--atom-color': atomColors[e] }"
          :aria-label="t('Element {element}', { element: e })"
          :aria-pressed="element === e"
          @click="palette(e)"
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
          v-for="item in tools"
          :key="item.id"
          :title="t(item.label)"
          :aria-label="t(item.label)"
          :aria-pressed="tool === item.id"
          @click="chooseTool(item.id)"
        >
          <component :is="item.icon" :size="19" />
        </button>
        <span class="molecule-divider" />
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
        <span class="molecule-divider" />
        <button
          :title="t('Beşli halka')"
          :aria-label="t('Beşli halka')"
          :aria-pressed="tool === 'ring5'"
          @click="chooseTool('ring5')"
        >
          <Pentagon :size="20" />
        </button>
        <button
          :title="t('Altılı halka')"
          :aria-label="t('Altılı halka')"
          :aria-pressed="tool === 'ring6'"
          @click="chooseTool('ring6')"
        >
          <Hexagon :size="20" />
        </button>
        <button
          :title="t('Benzen halkası')"
          :aria-label="t('Benzen halkası')"
          :aria-pressed="tool === 'ringB'"
          @click="chooseTool('ringB')"
        >
          <svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true">
            <path
              d="M12 2 21 7v10l-9 5-9-5V7Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="1.4" />
          </svg>
        </button>
      </div>
      <div class="molecule-stage">
        <svg
          ref="canvas"
          class="molecule-canvas"
          :class="{ 'molecule-erasing': tool === 'erase' }"
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
            @pointerdown.stop="bondAction(index)"
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
            <circle class="molecule-atom-hit" :cx="a.x" :cy="a.y" r="16" />
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
        <div class="molecule-properties">
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
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 168px;
}
.molecule-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  gap: 2px;
  background: #f8fafc;
  border-right: 1px solid #e5eaf1;
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
  padding: 14px 12px;
  background: #f8fafc;
  border-left: 1px solid #e5eaf1;
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
  margin-top: 20px;
  min-height: 143px;
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
  .molecule-workbench {
    grid-template-columns: 40px minmax(0, 1fr);
  }
  .molecule-inspector {
    grid-column: 1/-1;
    border-left: 0;
    border-top: 1px solid #e5eaf1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 16px;
    padding: 12px;
  }
  .molecule-inspector > .molecule-section-title {
    display: none;
  }
  .molecule-properties {
    margin: 0;
    min-height: 110px;
  }
  .molecule-presets {
    align-content: start;
  }
  .molecule-keyboard-add {
    grid-column: 1/-1;
  }
  .molecule-stage .molecule-canvas {
    height: 330px;
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
