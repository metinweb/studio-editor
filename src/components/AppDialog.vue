<script setup>
import { useEditorLocale } from '../lib/editor-locale'
import { onMounted, onBeforeUnmount, ref, useId } from 'vue'
import { X } from '@lucide/vue'

defineProps({ title: String, wide: Boolean })
const { t } = useEditorLocale()
const emit = defineEmits(['close'])
const dialog = ref(null)
const titleId = useId()
onMounted(() => dialog.value.showModal())
onBeforeUnmount(() => dialog.value?.close())
</script>

<template>
  <dialog
    ref="dialog"
    class="dialog"
    :class="{ 'dialog-wide': wide }"
    :aria-labelledby="titleId"
    @cancel.prevent="emit('close')"
    @click="
      (event) => {
        if (event.target === dialog) emit('close')
      }
    "
  >
    <header class="dialog-header">
      <div>
        <slot name="eyebrow" />
        <h2 :id="titleId">{{ title }}</h2>
      </div>
      <button class="icon-button" :aria-label="t('Kapat')" @click="emit('close')">
        <X :size="20" />
      </button>
    </header>
    <slot />
    <footer v-if="$slots.footer" class="dialog-footer"><slot name="footer" /></footer>
  </dialog>
</template>
