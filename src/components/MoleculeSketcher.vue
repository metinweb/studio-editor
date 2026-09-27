<script setup>
import { computed, ref } from 'vue'
import { elements, bondLines, moleculePreset } from '../lib/science.js'
import { useEditorLocale } from '../lib/editor-locale'
const { t } = useEditorLocale()
const props = defineProps({ modelValue: Object })
const emit = defineEmits(['update:modelValue'])
const tool = ref('atom'),
  element = ref('C'),
  order = ref(1),
  selected = ref(-1)
const canvas = ref(null)
const undo = ref([]),
  redo = ref([])
let drag = null
const graph = computed(() => props.modelValue)
const atom = computed(() => graph.value.atoms[selected.value])
function update(next, checkpoint = true) {
  if (checkpoint) {
    undo.value.push(JSON.stringify(graph.value))
    if (undo.value.length > 60) undo.value.shift()
    redo.value = []
  }
  emit('update:modelValue', next)
}
function edit(callback) {
  const next = JSON.parse(JSON.stringify(graph.value))
  callback(next)
  update(next)
}
function history(from, to) {
  if (!from.length) return
  to.push(JSON.stringify(graph.value))
  emit('update:modelValue', JSON.parse(from.pop()))
  selected.value = -1
}
function point(event) {
  const rect = canvas.value.getBoundingClientRect()
  return {
    x: Math.round(Math.max(20, Math.min(580, ((event.clientX - rect.left) / rect.width) * 600))),
    y: Math.round(Math.max(20, Math.min(340, ((event.clientY - rect.top) / rect.height) * 360))),
  }
}
function background(event) {
  if (event.target !== canvas.value || tool.value !== 'atom' || graph.value.atoms.length >= 100)
    return
  const index = graph.value.atoms.length
  edit((g) => g.atoms.push({ ...point(event), element: element.value }))
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
function pick(index, event) {
  if (tool.value === 'erase') return remove(index)
  if (tool.value === 'bond' && selected.value >= 0 && selected.value !== index) {
    const from = selected.value
    edit((g) => {
      const bond = g.bonds.find(
        (b) => (b.a === from && b.b === index) || (b.b === from && b.a === index),
      )
      if (bond) bond.order = Number(order.value)
      else if (g.bonds.length < 150) g.bonds.push({ a: from, b: index, order: Number(order.value) })
    })
    selected.value = -1
    return
  }
  selected.value = index
  if (event && tool.value === 'move') {
    drag = { index, before: JSON.stringify(graph.value) }
    canvas.value.setPointerCapture(event.pointerId)
  }
}
function move(event) {
  if (!drag) return
  const next = JSON.parse(JSON.stringify(graph.value))
  Object.assign(next.atoms[drag.index], point(event))
  update(next, false)
}
function finish() {
  if (drag && drag.before !== JSON.stringify(graph.value)) {
    undo.value.push(drag.before)
    if (undo.value.length > 60) undo.value.shift()
    redo.value = []
  }
  drag = null
}
function changeAtom(key, value) {
  if (atom.value)
    edit((g) => {
      g.atoms[selected.value][key] = value
    })
}
function choosePreset(name) {
  update(moleculePreset(name))
  selected.value = -1
}
function chooseTool(name) {
  tool.value = name
  selected.value = -1
}
function addAtCenter() {
  if (graph.value.atoms.length >= 100) return
  const index = graph.value.atoms.length
  edit((g) => g.atoms.push({ element: element.value, x: 300, y: 180 }))
  selected.value = index
}
function clear() {
  update({ atoms: [], bonds: [] })
  selected.value = -1
}
</script>
<template>
  <div class="molecule-tools" role="group" :aria-label="t('Çizim araçları')">
    <button
      v-for="item in [
        ['atom', 'Atom ekle'],
        ['bond', 'Bağ çiz'],
        ['move', 'Taşı'],
        ['erase', 'Sil'],
      ]"
      :key="item[0]"
      class="button"
      :aria-pressed="tool === item[0]"
      @click="chooseTool(item[0])"
    >
      {{ t(item[1]) }}
    </button>
    <label
      >{{ t('Element')
      }}<select v-model="element" class="text-input">
        <option v-for="e in elements" :key="e">{{ e }}</option>
      </select></label
    >
    <label
      >{{ t('Bağ derecesi')
      }}<select v-model.number="order" class="text-input">
        <option :value="1">{{ t('Tek bağ') }}</option>
        <option :value="2">{{ t('Çift bağ') }}</option>
        <option :value="3">{{ t('Üçlü bağ') }}</option>
      </select></label
    >
  </div>
  <p class="science-help">
    {{
      t(
        'Atom eklemek için boş alana dokunun. Bağ çizmek için iki atom seçin. Taşı aracıyla atomları sürükleyin.',
      )
    }}
  </p>
  <svg
    ref="canvas"
    class="molecule-canvas"
    viewBox="0 0 600 360"
    role="group"
    :aria-label="t('Molekül çizim alanı')"
    @pointerdown="background"
    @pointermove="move"
    @pointerup="finish"
    @pointercancel="finish"
  >
    <g
      v-for="(bond, index) in graph.bonds"
      :key="'b' + index"
      role="button"
      tabindex="0"
      :aria-label="t('Bağ {a}–{b}', { a: bond.a + 1, b: bond.b + 1 })"
      @pointerdown.stop="
        tool === 'erase'
          ? edit((g) => g.bonds.splice(index, 1))
          : edit((g) => (g.bonds[index].order = Number(order)))
      "
      @keydown.enter.prevent="edit((g) => (g.bonds[index].order = Number(order)))"
      @keydown.delete.prevent="edit((g) => g.bonds.splice(index, 1))"
    >
      <line
        :x1="graph.atoms[bond.a].x"
        :y1="graph.atoms[bond.a].y"
        :x2="graph.atoms[bond.b].x"
        :y2="graph.atoms[bond.b].y"
        stroke="transparent"
        stroke-width="18"
      />
      <line
        v-for="(line, i) in bondLines(graph, bond)"
        :key="i"
        v-bind="line"
        stroke="#24334b"
        stroke-width="2"
      />
    </g>
    <g
      v-for="(a, index) in graph.atoms"
      :key="index"
      role="button"
      tabindex="0"
      :aria-label="t('Atom {n}: {element}', { n: index + 1, element: a.element })"
      :aria-pressed="selected === index"
      @pointerdown.stop="pick(index, $event)"
      @keydown.enter.prevent="pick(index)"
      @keydown.space.prevent="pick(index)"
      @keydown.delete.prevent="remove(index)"
    >
      <circle
        :cx="a.x"
        :cy="a.y"
        r="17"
        :fill="selected === index ? '#ede6ff' : 'white'"
        :stroke="selected === index ? '#7351b5' : '#d8dfe8'"
      />
      <text :x="a.x" :y="a.y + 7" text-anchor="middle" font-size="21" fill="#172238">
        {{ a.element }}
      </text>
    </g>
  </svg>
  <div class="molecule-tools">
    <button class="button" @click="addAtCenter">
      {{ t('Merkeze atom ekle') }}
    </button>
    <button class="button" :disabled="!undo.length" @click="history(undo, redo)">
      {{ t('Çizimi geri al') }}
    </button>
    <button class="button" :disabled="!redo.length" @click="history(redo, undo)">
      {{ t('Çizimi yinele') }}
    </button>
    <button class="button" @click="clear">
      {{ t('Temizle') }}
    </button>
    <button
      v-for="p in [
        ['water', 'Su'],
        ['ethanol', 'Etanol'],
        ['benzene', 'Benzen'],
      ]"
      :key="p[0]"
      class="button"
      @click="choosePreset(p[0])"
    >
      {{ t(p[1]) }}
    </button>
  </div>
  <div v-if="atom" class="molecule-tools atom-properties">
    <strong>{{ t('Seçili atom') }} {{ selected + 1 }}</strong>
    <label
      >{{ t('Atom elementi')
      }}<select
        :aria-label="t('Atom elementi')"
        :value="atom.element"
        class="text-input"
        @change="changeAtom('element', $event.target.value)"
      >
        <option v-for="e in elements" :key="e">{{ e }}</option>
      </select></label
    >
    <label
      >X<input
        type="number"
        min="20"
        max="580"
        :value="atom.x"
        class="text-input"
        @change="changeAtom('x', Math.max(20, Math.min(580, Number($event.target.value) || 20)))"
    /></label>
    <label
      >Y<input
        type="number"
        min="20"
        max="340"
        :value="atom.y"
        class="text-input"
        @change="changeAtom('y', Math.max(20, Math.min(340, Number($event.target.value) || 20)))"
    /></label>
    <button class="button" @click="remove(selected)">{{ t('Atomu sil') }}</button>
  </div>
  <p class="science-help">
    {{
      t(
        'Yapısal çizim aracıdır; değerlik kontrolü ve otomatik hidrojen tamamlama yapmaz. Karbonlara bağlı hidrojenler gösterilmez.',
      )
    }}
  </p>
</template>
