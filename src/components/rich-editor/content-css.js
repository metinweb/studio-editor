import { onBeforeUnmount, ref, watch } from 'vue'
import {
  normalizeContentCss,
  installContentCss,
  normalizeBodyClass,
} from '../../lib/content-css.js'

/** Host and user stylesheets plus body classes for the content iframe. */
export function useContentCss({ props, emit, frame, onBodyClass }) {
  const cssUrls = ref([])
  const cssStatus = ref([])
  const contentBodyClass = ref(normalizeBodyClass(props.bodyClass))
  let removeContentCss = () => {}
  function syncContentCss() {
    removeContentCss()
    cssStatus.value = []
    if (!frame.value?.contentDocument?.head) return
    removeContentCss = installContentCss(frame.value.contentDocument, cssUrls.value, (item) => {
      cssStatus.value = [...cssStatus.value.filter((old) => old.url !== item.url), item]
      emit('content-css-status', item)
    })
  }
  function setContentCss(value) {
    try {
      cssUrls.value = normalizeContentCss(value, document.baseURI)
      syncContentCss()
    } catch (error) {
      emit('content-css-status', { url: '', status: 'error', message: error.message })
    }
  }
  function applyContentCss(value) {
    if (!props.allowContentCss || props.disabled) return
    setContentCss(value)
    emit('update:contentCss', [...cssUrls.value])
  }
  function applyBodyClass(value) {
    contentBodyClass.value = normalizeBodyClass(value)
    onBodyClass()
    emit('update:bodyClass', contentBodyClass.value)
  }
  watch(
    () => props.bodyClass,
    (value) => {
      contentBodyClass.value = normalizeBodyClass(value)
      onBodyClass()
    },
  )
  watch(() => props.contentCss, setContentCss, { deep: true })
  onBeforeUnmount(() => removeContentCss())
  return { cssUrls, cssStatus, contentBodyClass, setContentCss, applyContentCss, applyBodyClass }
}
