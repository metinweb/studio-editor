<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { StudioEditor, loadCollaboration } from 'studio-editor'
import 'studio-editor/style.css'
import { mediaAdapter } from './media-adapter'

const first = ref('<p>Birinci belge</p>')
const params = new URLSearchParams(window.location.search)
if (params.has('empty')) first.value = ''
const readonly = ref(params.get('mode') === 'readonly')
const disabled = ref(params.get('mode') === 'disabled')
const locale = ref('tr')
const pasteMode = ref('keep')
const tablePasteStyle = ref('target')
const lastPaste = ref(null)
const compact = ref(false)
const hideControls = ref(false)
const customMessages = ref(false)
const second = ref('<p>İkinci belge</p>')
const editor = ref(null)
const secondEditor = ref(null)
const sharedReady = ref(false),
  connected = ref(true)
let sharedA, sharedB, bindingA, bindingB
async function startShared() {
  if (sharedReady.value) return
  const { createSharedDocument, bindSharedDocument } = await loadCollaboration()
  const seed = createSharedDocument({ initial: editor.value.getModel() }),
    update = seed.encode()
  seed.destroy()
  sharedA = createSharedDocument({
    update,
    onUpdate: (bytes) => {
      if (connected.value) bindingB?.receive(bytes)
    },
  })
  sharedB = createSharedDocument({
    update,
    onUpdate: (bytes) => {
      if (connected.value) bindingA?.receive(bytes)
    },
  })
  const onError = (error) => (modelError.value = error.message)
  bindingA = bindSharedDocument(editor.value, sharedA, { onError })
  bindingB = bindSharedDocument(secondEditor.value, sharedB, { onError })
  sharedReady.value = true
}
function toggleConnection() {
  connected.value = !connected.value
  if (connected.value) {
    bindingA.receive(sharedB.encode())
    bindingB.receive(sharedA.encode())
  }
}
onBeforeUnmount(() => {
  bindingA?.dispose()
  bindingB?.dispose()
  sharedA?.destroy()
  sharedB?.destroy()
})
const showFirst = ref(true)
const saved = ref('')
const transaction = ref(null)
const snapshot = ref(null)
const historyStats = ref(null)
const schemaModel = ref(null)
const modelError = ref('')
function readModel() {
  schemaModel.value = editor.value.getModel()
}
function changeModel() {
  try {
    const model = schemaModel.value || editor.value.getModel()
    editor.value.applyOperations({
      baseRevision: model.revision,
      operations: [
        {
          type: 'replaceText',
          blockId: model.blocks[0].id,
          path: [0],
          from: 0,
          removed: 'Birinci',
          inserted: 'Şemalı',
        },
      ],
    })
  } catch (e) {
    modelError.value = e.message
  }
}
let disposePlugin
function pluginCommand() {
  disposePlugin ||= editor.value.registerPlugin({
    id: 'example',
    commands: [
      { id: 'hello', title: 'Hello', execute: (api) => api.insertHTML('<p>Eklenti metni</p>') },
    ],
  })
  editor.value.executeCommand('example/hello')
}
const showRemote = ref(false)
const remoteContent = ref('<p>Sunucu medyası</p>')
function readState() {
  snapshot.value = editor.value?.getDocument()
  historyStats.value = editor.value?.getHistoryStats()
}
</script>

<template>
  <h1 id="host-title">Studio Editor entegrasyon örneği</h1>
  <p id="host-text">Bu sayfanın stilleri editörden bağımsızdır.</p>
  <button id="host-button" @click="editor?.setHTML('<p>API ile değişti</p>')">
    API ile değiştir
  </button>
  <button @click="editor?.undo()">API geri al</button>
  <button @click="editor?.setHTML(editor.getHTML())">Aynı HTML'i uygula</button>
  <button @click="editor?.openSource()">Kaynağı aç</button>
  <button @click="showFirst = !showFirst">Editörü aç / kapat</button>
  <button @click="readState">Belge durumunu oku</button>
  <button @click="readModel">Şemalı belgeyi oku</button>
  <button @click="changeModel">Şemalı işlem uygula</button>
  <button @click="pluginCommand">Örnek eklentiyi çalıştır</button>
  <button :disabled="sharedReady" @click="startShared">İki editörü eşleştir</button>
  <button v-if="sharedReady" @click="toggleConnection">
    {{ connected ? 'Bağlantıyı kes' : 'Yeniden bağlan' }}
  </button>
  <button @click="showRemote = !showRemote">Sunucu adaptörü örneğini aç / kapat</button>
  <div class="example-options">
    <label
      >Yapıştırma modu
      <select v-model="pasteMode" aria-label="Yapıştırma modu">
        <option value="keep">Biçimi koru</option>
        <option value="clean">Biçimi temizle</option>
        <option value="text">Yalnızca metin</option>
      </select>
    </label>
    <label><input v-model="readonly" type="checkbox" /> Salt okunur örnek</label>
    <label
      >Tablo yapıştırma biçimi<select
        v-model="tablePasteStyle"
        aria-label="Tablo yapıştırma biçimi"
      >
        <option value="target">Hedef</option>
        <option value="source">Kaynak</option>
      </select></label
    >
    <label><input v-model="disabled" type="checkbox" /> Devre dışı örnek</label>
    <label><input v-model="compact" type="checkbox" /> Sade araçlar</label>
    <label><input v-model="hideControls" type="checkbox" /> Araçları gizle</label>
    <label><input v-model="customMessages" type="checkbox" /> Özel metinler</label>
    <label
      >Örnek dil
      <select v-model="locale" aria-label="Örnek dil">
        <option value="tr">Türkçe</option>
        <option value="en">English</option>
      </select></label
    >
  </div>
  <div class="examples">
    <StudioEditor
      v-if="showFirst"
      ref="editor"
      v-model="first"
      v-model:paste-mode="pasteMode"
      v-model:table-paste-style="tablePasteStyle"
      @paste="lastPaste = $event"
      :height="520"
      :readonly="readonly"
      :disabled="disabled"
      :locale="locale"
      :mentions="[
        { id: 'demo-ada', label: 'Ada Lovelace' },
        { id: 'demo-grace', label: 'Grace Hopper' },
      ]"
      placeholder="İçeriğinizi buraya yazın…"
      :toolbar="hideControls ? false : compact ? ['history', 'format'] : true"
      :menubar="hideControls ? false : compact ? ['edit', 'insert'] : true"
      :messages="customMessages ? { Kalın: '<b>Özel kalın</b>' } : {}"
      @save="saved = $event"
      @transaction="transaction = $event"
    />
    <StudioEditor ref="secondEditor" v-model="second" :height="480" />
    <StudioEditor
      v-if="showRemote"
      locale="tr"
      v-model="remoteContent"
      :media-adapter="mediaAdapter"
      :readonly="readonly"
      :disabled="disabled"
      :height="480"
    />
  </div>
  <output id="first-content">{{ first }}</output>
  <output id="paste-info">{{ JSON.stringify(lastPaste) }}</output>
  <output id="second-content">{{ second }}</output>
  <output id="saved-content">{{ saved }}</output>
  <output id="transaction">{{ JSON.stringify(transaction) }}</output>
  <output id="document-state">{{ JSON.stringify(snapshot) }}</output>
  <output id="history-stats">{{ JSON.stringify(historyStats) }}</output>
  <output id="schema-model">{{ JSON.stringify(schemaModel) }}</output>
  <output id="model-error">{{ modelError }}</output>
</template>

<style>
body {
  margin: 27px;
  background: #fffae6;
  color: #224422;
  font:
    17px Georgia,
    serif;
}
#host-title {
  margin: 17px 0;
  color: #752c45;
  font-size: 29px;
}
#host-button {
  border: 3px solid #752c45;
  padding: 13px;
}
.examples {
  display: grid;
  gap: 28px;
  margin-top: 24px;
}
.example-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}
output {
  display: block;
  margin: 12px 0;
  overflow-wrap: anywhere;
  max-height: 150px;
  overflow: auto;
}
</style>
