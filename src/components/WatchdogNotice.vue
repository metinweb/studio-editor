<script setup>
import { RotateCcw, TriangleAlert, X } from '@lucide/vue'
import { useEditorLocale } from '../lib/editor-locale'

defineProps({ status: String })
const emit = defineEmits(['restart', 'dismiss'])
const { t } = useEditorLocale()
</script>

<template>
  <div v-if="status === 'recovered'" class="native-message watchdog-notice" role="status">
    <TriangleAlert :size="15" />{{
      t('Editör bir hata nedeniyle yeniden başlatıldı. İçeriğiniz korundu.')
    }}<button class="icon-button" :aria-label="t('Bilgiyi kapat')" @click="emit('dismiss')">
      <X :size="14" />
    </button>
  </div>
  <div v-else-if="status === 'failed'" class="watchdog-failed" role="alert">
    <TriangleAlert :size="22" />
    <div>
      <strong>{{ t('Editör tekrarlanan hatalar nedeniyle durduruldu.') }}</strong>
      <p>
        {{
          t(
            'İçeriğiniz korunuyor ve kaydedilebilir. Sorun devam ederse sayfayı yenilemeden önce içeriği dışa aktarın.',
          )
        }}
      </p>
      <button class="button primary" @click="emit('restart')">
        <RotateCcw :size="15" />{{ t('Editörü yeniden başlat') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.watchdog-notice {
  gap: 8px;
}
.watchdog-failed {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  margin: 12px;
  padding: 18px 20px;
  border: 1px solid var(--studio-danger-border, #f0b7b2);
  border-radius: 12px;
  background: var(--studio-danger-bg, #fff4f2);
  color: var(--studio-danger-text, #7a271a);
}
.watchdog-failed p {
  margin: 6px 0 12px;
}
.watchdog-failed .button {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
</style>
