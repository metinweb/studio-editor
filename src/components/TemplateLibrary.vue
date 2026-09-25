<script setup>
import { useEditorLocale } from '../lib/editor-locale'
const { t, locale } = useEditorLocale()
import { computed, onMounted, ref } from 'vue'
import {
  FileText,
  NotebookPen,
  BriefcaseBusiness,
  Plus,
  Trash2,
  LayoutTemplate,
  Check,
} from '@lucide/vue'
import AppDialog from './AppDialog.vue'
import { escapeHtml, renderDocument } from '../lib/content'
import { useTemplates } from '../stores/templates'
const props = defineProps({ engine: Object })
const emit = defineEmits(['close'])
const store = useTemplates()
const selected = ref('brief')
const title = ref('Yeni proje')
const owner = ref('Ekibimiz')
const name = ref('')
const saved = ref(false)
const templates = [
  {
    id: 'brief',
    name: 'Proje özeti',
    description: 'Hedef, kapsam ve yol haritası',
    icon: BriefcaseBusiness,
    color: 'violet',
  },
  {
    id: 'meeting',
    name: 'Toplantı notları',
    description: 'Gündem, kararlar ve aksiyonlar',
    icon: NotebookPen,
    color: 'green',
  },
  {
    id: 'article',
    name: 'Editoryal yazı',
    description: 'Güçlü bir başlangıç ve net bölümler',
    icon: FileText,
    color: 'orange',
  },
]
const html = computed(() => {
  const custom = store.items.find((t) => t.id === selected.value)
  if (custom) return custom.html
  const heading = `<p style="color:#7953bd;font:12px sans-serif;letter-spacing:2px">${selected.value === 'meeting' ? 'TOPLANTI NOTLARI' : selected.value === 'article' ? 'EDİTORYAL' : 'PROJE ÖZETİ'}</p><h1>${escapeHtml(title.value || 'Başlıksız')}</h1><p style="color:#8c929f;font-size:14px">${escapeHtml(owner.value)} · ${new Date().toLocaleDateString('tr')}</p><hr>`
  if (selected.value === 'meeting')
    return (
      heading +
      '<h2>Gündem</h2><ol><li>Öncelikler ve güncel durum</li><li>Karar bekleyen konular</li></ol><h2>Alınan kararlar</h2><p>Toplantıda üzerinde uzlaşılan kararları yazın.</p><h2>Aksiyon planı</h2><table style="width:100%" data-studio-table="striped"><tr><th scope="col">Aksiyon</th><th scope="col">Sorumlu</th><th scope="col">Termin</th></tr><tr><td>İlk adım</td><td>Ekip</td><td>Bu hafta</td></tr></table><p><br></p>'
    )
  if (selected.value === 'article')
    return (
      heading +
      '<p style="font-size:21px;color:#6b6178">Okuyucuyu yazıya davet eden kısa bir giriş yazın.</p><h2>Hikâyenin başlangıcı</h2><p>Konuyu somut bir örnekle anlatın.</p><blockquote><p>Okuyucunun hatırlamasını istediğiniz düşünce.</p></blockquote><h2>Detaylara bakalım</h2><p>Verileri ve örnekleri burada geliştirin.</p><h2>Bir sonraki adım</h2><p>Okuyucunuza uygulanabilir bir öneri sunun.</p>'
    )
  return (
    heading +
    '<h2>Neyi başarmak istiyoruz?</h2><p>Projenin amacını ve başarı ölçütlerini açıklayın.</p><h2>Kapsam</h2><ul><li>Teslim edilecek ilk çalışma</li><li>Öncelikli gereksinimler</li></ul><h2>Yol haritası</h2><table style="width:100%" data-studio-table="striped"><tr><th scope="col">Aşama</th><th scope="col">Çıktı</th><th scope="col">Durum</th></tr><tr><td>Keşif</td><td>İhtiyaç analizi</td><td>Planlandı</td></tr><tr><td>Uygulama</td><td>İlk sürüm</td><td>Bekliyor</td></tr></table><h2>Başarı ölçütleri</h2><p>Sonuçları nasıl değerlendireceğimizi tanımlayın.</p>'
  )
})
const preview = computed(() => renderDocument({ title: 'Şablon önizlemesi', content: html.value }))
function insert() {
  props.engine.insert(html.value)
  emit('close')
}
async function save() {
  saved.value = await store.save(name.value, props.engine.getHTML())
  if (saved.value) name.value = ''
}
async function removeTemplate(id) {
  await store.remove(id)
  if (selected.value === id && !store.items.some((item) => item.id === id)) selected.value = 'brief'
}
onMounted(() => store.load())
</script>
<template>
  <AppDialog :title="t('Şablon kütüphanesi')" wide @close="emit('close')">
    <template #eyebrow
      ><span class="review-eyebrow"> {{ t('DAHA AZ HAZIRLIK, DAHA ÇOK İÇERİK') }} </span></template
    >
    <div class="template-layout">
      <div class="template-list">
        <p class="template-section-label">{{ t('HAZIR ŞABLONLAR') }}</p>
        <button
          v-for="item in templates"
          :key="item.id"
          class="template-card"
          :class="[item.color, { active: selected === item.id }]"
          @click="selected = item.id"
        >
          <span class="template-icon"><component :is="item.icon" :size="20" /></span
          ><span
            ><strong>{{ item.name }}</strong
            ><small>{{ item.description }}</small></span
          ><Check v-if="selected === item.id" :size="16" />
        </button>
        <p class="template-section-label">{{ t('ŞABLONLARIM') }}</p>
        <p v-if="!store.items.length" class="review-note">
          {{ t('Sık kullandığınız belge düzenlerini burada saklayın.') }}
        </p>
        <div v-for="item in store.items" :key="item.id" class="custom-template">
          <button :aria-pressed="selected === item.id" @click="selected = item.id">
            <LayoutTemplate :size="16" />{{ item.name }}</button
          ><button :aria-label="`${item.name} şablonunu sil`" @click="removeTemplate(item.id)">
            <Trash2 :size="14" />
          </button>
        </div>
        <form class="template-save" @submit.prevent="save">
          <label>
            {{ t('Bu belgeyi şablon olarak sakla') }}
            <input
              v-model="name"
              maxlength="80"
              :placeholder="t('Şablon adı')"
              :aria-label="t('Şablon adı')"
              required /></label
          ><button class="button" :disabled="store.busy || !name.trim()" type="submit">
            <Plus :size="14" /> {{ t('Şablonu kaydet') }}
          </button>
          <p v-if="saved" role="status">{{ t('Şablon kaydedildi.') }}</p>
        </form>
        <p v-if="store.error" class="review-error" role="alert">{{ store.error }}</p>
      </div>
      <div class="template-preview">
        <div v-if="templates.some((t) => t.id === selected)" class="template-fields">
          <label>
            {{ t('Belge başlığı') }}
            <input v-model="title" :aria-label="t('Şablon başlığı')" /></label
          ><label>
            {{ t('Hazırlayan') }} <input v-model="owner" :aria-label="t('Şablonu hazırlayan')"
          /></label>
        </div>
        <iframe :title="t('Şablon önizlemesi')" sandbox="" :srcdoc="preview" />
      </div>
    </div>
    <template #footer
      ><span class="template-footer-note">
        {{ t('İmleç konumuna eklenir. Geri alınabilir.') }} </span
      ><button class="button" @click="emit('close')">{{ t('Vazgeç') }}</button
      ><button class="button primary" @click="insert">
        <Plus :size="16" /> {{ t('Şablonu ekle') }}
      </button></template
    >
  </AppDialog>
</template>
