import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import { StudioEditor } from '../packages/editor/dist/studio-editor.js'
import '../packages/editor/dist/studio-editor.css'

const content = ref('<p>Ready</p>')
window.benchmark = { ready: false, samples: [] }
const painted = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
createApp({
  setup() {
    return () =>
      h(StudioEditor, {
        modelValue: content.value,
        'onUpdate:modelValue': (html) => {
          content.value = html
        },
        height: 750,
        onReady(api) {
          const root = document.querySelector('iframe').contentDocument.body
          const bench = window.benchmark
          bench.load = async (html) => {
            const start = performance.now()
            api.setHTML(html)
            await Promise.all(
              [...root.querySelectorAll('img')].map((img) => img.decode().catch(() => {})),
            )
            await painted()
            return performance.now() - start
          }
          root.addEventListener(
            'beforeinput',
            () => {
              bench.inputStart = performance.now()
            },
            true,
          )
          root.addEventListener('input', async () => {
            const start = bench.inputStart
            await painted()
            bench.samples.push(performance.now() - start)
          })
          bench.caret = () => {
            root.focus()
            const target = root.lastElementChild
            const range = root.ownerDocument.createRange()
            range.selectNodeContents(target)
            range.collapse(false)
            const selection = root.ownerDocument.getSelection()
            selection.removeAllRanges()
            selection.addRange(range)
            target.scrollIntoView({ block: 'end' })
          }
          bench.select = async () => {
            const start = performance.now()
            bench.caret()
            await painted()
            return performance.now() - start
          }
          bench.undo = async () => {
            const start = performance.now()
            api.undo()
            await painted()
            return performance.now() - start
          }
          bench.stats = () => api.getHistoryStats()
          bench.ready = true
        },
      })
  },
})
  .use(createPinia())
  .mount('#app')
