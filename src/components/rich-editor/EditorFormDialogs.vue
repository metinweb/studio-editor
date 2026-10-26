<script setup>
import { ref, watch } from 'vue'
import { Check, Table2 } from '@lucide/vue'
import AppDialog from '../AppDialog.vue'
import ResponsivePreview from '../ResponsivePreview.vue'
import { symbolGroups } from '../../lib/menu-options.js'
import { escapeHtml } from '../../lib/content'
import { useEditorLocale } from '../../lib/editor-locale'
import { codeLanguages, shortcuts } from './options.js'
import { validRegionName } from '../../editor/restricted-editing.js'
import { useRichEditor } from './context.js'

const { t } = useEditorLocale()
const {
  dialog,
  engine,
  state,
  command,
  insert,
  anchorOptions,
  tableForm,
  metrics,
  previewHtml,
  foundCommands,
  commandQuery,
  runFoundCommand,
  onMenuKeys,
} = useRichEditor()
const close = () => (dialog.value = null)
const linkForm = ref({ href: '', text: '', blank: false })
const linkError = ref('')
const imageForm = ref({ alt: '', width: '' })
const codeForm = ref({ language: 'javascript', code: '' })
const listForm = ref({ start: 1, reversed: false })
const symbolGroup = ref('Simgeler')
watch(
  dialog,
  (name) => {
    linkError.value = ''
    if (name === 'link')
      linkForm.value = state.value.link
        ? { ...state.value.link }
        : { href: '', text: engine.value.range().toString(), blank: false }
    if (name === 'image') imageForm.value = { ...state.value.image }
    if (name === 'listProperties')
      listForm.value = { start: state.value.listStart, reversed: state.value.listReversed }
  },
  { immediate: true },
)
function applyLink() {
  if (!engine.value.link(linkForm.value)) {
    linkError.value = 'Geçerli bir https://, http://, mailto:, tel: veya göreli adres girin.'
    return
  }
  close()
}
function removeLink() {
  command('unlink')
  close()
}
function applyTable() {
  command('insertTable', tableForm.value.rows, tableForm.value.columns, tableForm.value.header)
  close()
}
function applyImage() {
  command('image', imageForm.value)
  close()
}
function applyCode() {
  insert(
    `<pre><code class="language-${codeForm.value.language}">${escapeHtml(codeForm.value.code)}</code></pre><p><br></p>`,
  )
  close()
  codeForm.value.code = ''
}
function applyListProperties() {
  command('listProperties', Number(listForm.value.start), listForm.value.reversed)
  close()
}
function insertSymbol(value) {
  insert(escapeHtml(value))
  close()
}
const regionName = ref('')
const regionError = ref('')
watch(dialog, () => {
  regionName.value = ''
  regionError.value = ''
})
function applyEditableRegion() {
  const name = regionName.value.trim()
  if (name && !validRegionName(name)) {
    regionError.value =
      'Alan adı harfle başlamalı; yalnızca harf, rakam, nokta, alt çizgi ve tire içerebilir.'
    return
  }
  if (!engine.value.markEditable(name || 'true')) {
    regionError.value =
      'Bu seçim düzenlenebilir alan yapılamadı. Mevcut bir alanın dışında metin veya bloklar seçin.'
    return
  }
  close()
}
</script>

<template>
  <AppDialog v-if="dialog === 'preview'" :title="t('Belge önizlemesi')" wide @close="close"
    ><ResponsivePreview :html="previewHtml" />
    <template #footer
      ><button class="button" @click="close">{{ t('Kapat') }}</button
      ><button class="button primary" @click="dialog = 'print'">
        {{ t('Yazdır / PDF') }}
      </button></template
    ></AppDialog
  >
  <AppDialog v-if="dialog === 'metrics' && metrics" :title="t('Sözcük sayımı')" @close="close"
    ><table class="document-metrics">
      <thead>
        <tr>
          <th></th>
          <th>{{ t('Belgenin tamamı') }}</th>
          <th>{{ t('Seçili metin') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="[key, label] in [
            ['words', 'Sözcükler'],
            ['characters', 'Karakterler'],
            ['noSpaces', 'Boşluksuz karakterler'],
          ]"
          :key="key"
        >
          <th>{{ t(label) }}</th>
          <td>{{ metrics.document[key] }}</td>
          <td>{{ metrics.selection[key] }}</td>
        </tr>
      </tbody>
    </table></AppDialog
  >
  <AppDialog v-if="dialog === 'listProperties'" :title="t('Liste özellikleri')" @close="close">
    <form id="list-properties" class="native-form" @submit.prevent="applyListProperties">
      <label class="field-label"
        >{{ t('Başlangıç numarası')
        }}<input
          v-model="listForm.start"
          class="text-input"
          type="number"
          min="-999999"
          max="999999"
          step="1"
          required
          :aria-label="t('Başlangıç numarası')"
      /></label>
      <label class="native-checkbox"
        ><input v-model="listForm.reversed" type="checkbox" />{{ t('Ters numaralandırma') }}</label
      >
      <p class="muted">{{ t('Seçili listeye uygulanır.') }}</p>
    </form>
    <template #footer
      ><button class="button" @click="close">{{ t('Vazgeç') }}</button
      ><button class="button primary" form="list-properties" type="submit">
        {{ t('Uygula') }}
      </button></template
    >
  </AppDialog>
  <AppDialog v-if="dialog === 'symbols'" :title="t('Özel karakterler ve emoji')" @close="close">
    <div class="native-form">
      <div class="symbol-tabs" role="group" :aria-label="t('Karakter grupları')">
        <button
          v-for="(_, name) in symbolGroups"
          :key="name"
          :aria-pressed="symbolGroup === name"
          @click="symbolGroup = name"
        >
          {{ t(name) }}
        </button>
      </div>
      <div class="symbol-grid">
        <button
          v-for="symbol in symbolGroups[symbolGroup]"
          :key="symbol"
          :aria-label="symbol"
          @click="insertSymbol(symbol)"
        >
          {{ symbol }}
        </button>
      </div>
    </div>
  </AppDialog>
  <AppDialog v-if="dialog === 'commands'" :title="t('Komut bul')" @close="close">
    <div class="native-form command-search-panel">
      <input
        v-model="commandQuery"
        class="text-input"
        :placeholder="t('Komut veya özellik ara')"
        :aria-label="t('Komut veya özellik ara')"
        autofocus
        @keydown.down.prevent="
          $event.currentTarget.nextElementSibling?.querySelector('button:not(:disabled)')?.focus()
        "
      />
      <div class="command-results" @keydown="onMenuKeys">
        <button
          v-for="item in foundCommands"
          :key="item.label"
          :disabled="item.disabled"
          @click="runFoundCommand(item)"
        >
          <span>{{ t(item.label) }}</span
          ><small>{{ item.trail }}</small>
        </button>
        <p v-if="!foundCommands.length" class="muted">{{ t('Komut bulunamadı.') }}</p>
      </div>
    </div>
  </AppDialog>
  <AppDialog v-if="dialog === 'help'" :title="t('Klavye kısayolları')" @close="close">
    <dl class="editor-shortcuts native-form">
      <template v-for="[label, key] in shortcuts" :key="label"
        ><dt>{{ t(label) }}</dt>
        <dd>
          <kbd>{{ key }}</kbd>
        </dd></template
      >
    </dl>
  </AppDialog>
  <AppDialog v-if="dialog === 'link'" :title="t('Bağlantı')" @close="close">
    <form id="link-form" class="native-form" @submit.prevent="applyLink">
      <label class="field-label"
        >{{ t('Bağlantı adresi')
        }}<input
          v-model="linkForm.href"
          class="text-input"
          :aria-label="t('Bağlantı adresi')"
          :placeholder="t('https://ornek.com')"
          required
          autofocus /></label
      ><label class="field-label"
        >{{ t('Görünen metin')
        }}<input v-model="linkForm.text" class="text-input" :aria-label="t('Görünen metin')"
      /></label>
      <label v-if="anchorOptions.length" class="field-label"
        >{{ t('Belge içindeki hedef')
        }}<select
          class="text-input"
          :aria-label="t('Belge içindeki hedef')"
          @change="linkForm.href = $event.target.value"
        >
          <option value="">{{ t('Hedef seçin') }}</option>
          <option v-for="anchor in anchorOptions" :key="anchor.id" :value="'#' + anchor.id">
            #{{ anchor.id }} — {{ anchor.label }}
          </option>
        </select></label
      >
      <p class="muted">{{ t('Seçili metin varsa biçimlendirmesi korunur.') }}</p>
      <label class="native-checkbox"
        ><input v-model="linkForm.blank" type="checkbox" /> {{ t('Yeni sekmede aç') }}</label
      >
      <p v-if="linkError" class="error-banner" role="alert">{{ t(linkError) }}</p>
    </form>
    <template #footer
      ><button v-if="state.link" class="button" @click="removeLink">
        {{ t('Bağlantıyı kaldır') }}</button
      ><button class="button" @click="close">{{ t('Vazgeç') }}</button
      ><button class="button primary" form="link-form" type="submit">
        <Check :size="16" /> {{ t('Bağlantıyı uygula') }}
      </button></template
    >
  </AppDialog>
  <AppDialog v-if="dialog === 'table'" :title="t('Tablo ekle')" @close="close"
    ><form id="table-form" class="native-form" @submit.prevent="applyTable">
      <div class="native-form-row">
        <label class="field-label"
          >{{ t('Satır sayısı')
          }}<input
            v-model="tableForm.rows"
            class="text-input"
            type="number"
            min="1"
            max="20"
            required
            :aria-label="t('Satır sayısı')" /></label
        ><label class="field-label"
          >{{ t('Sütun sayısı')
          }}<input
            v-model="tableForm.columns"
            class="text-input"
            type="number"
            min="1"
            max="10"
            required
            :aria-label="t('Sütun sayısı')"
        /></label>
      </div>
      <label class="native-checkbox"
        ><input v-model="tableForm.header" type="checkbox" />
        {{ t('İlk satır başlık olsun') }}</label
      >
      <p class="muted">
        {{
          t(
            'Hücreler arasında Tab ile ilerleyin. Tabloya tıklayarak satır ve sütun işlemlerine ulaşın.',
          )
        }}
      </p>
    </form>
    <template #footer
      ><button class="button" @click="close">{{ t('Vazgeç') }}</button
      ><button class="button primary" form="table-form" type="submit">
        <Table2 :size="16" /> {{ t('Tabloyu oluştur') }}
      </button></template
    ></AppDialog
  >
  <AppDialog v-if="dialog === 'image'" :title="t('Görsel özellikleri')" @close="close"
    ><form id="image-form" class="native-form" @submit.prevent="applyImage">
      <label class="field-label"
        >{{ t('Alternatif metin')
        }}<input
          v-model="imageForm.alt"
          class="text-input"
          :aria-label="t('Görsel alternatif metni')" /></label
      ><label class="field-label"
        >{{ t('Genişlik')
        }}<input
          v-model="imageForm.width"
          class="text-input"
          :aria-label="t('Görsel genişliği')"
          :placeholder="t('Örn. 480px veya 100%')"
          pattern="[0-9]{1,4}(px|%)?"
      /></label>
      <p class="muted">{{ t('Oranlar korunur. Doğal boyut için genişliği boş bırakın.') }}</p>
    </form>
    <template #footer
      ><button class="button" @click="close">{{ t('Vazgeç') }}</button
      ><button class="button primary" type="submit" form="image-form">
        {{ t('Görseli güncelle') }}
      </button></template
    ></AppDialog
  >
  <AppDialog v-if="dialog === 'editableRegion'" :title="t('Düzenlenebilir alan yap')" @close="close"
    ><form id="editable-region-form" class="native-form" @submit.prevent="applyEditableRegion">
      <p class="muted">
        {{
          t(
            'Kısıtlı düzenleme modunda yalnızca bu alanlar değiştirilebilir. Bir paragraf içindeki seçim satır içi alan, birden fazla blok seçimi blok alanı olur.',
          )
        }}
      </p>
      <label class="field-label"
        >{{ t('Alan adı (isteğe bağlı)')
        }}<input
          v-model="regionName"
          class="text-input"
          maxlength="80"
          :placeholder="t('Örn. musteri_adi')"
          :aria-label="t('Alan adı (isteğe bağlı)')"
          autofocus
      /></label>
      <p v-if="regionError" class="error-banner" role="alert">{{ t(regionError) }}</p>
    </form>
    <template #footer
      ><button class="button" @click="close">{{ t('Vazgeç') }}</button
      ><button class="button primary" form="editable-region-form" type="submit">
        {{ t('Alanı oluştur') }}
      </button></template
    ></AppDialog
  >
  <AppDialog v-if="dialog === 'code'" :title="t('Kod bloğu ekle')" @close="close"
    ><form id="code-form" class="native-form" @submit.prevent="applyCode">
      <label class="field-label"
        >{{ t('Dil')
        }}<select v-model="codeForm.language" class="text-input" :aria-label="t('Kod dili')">
          <option v-for="language in codeLanguages" :key="language" :value="language">
            {{ language }}
          </option>
        </select></label
      ><label class="field-label"
        >{{ t('Kod')
        }}<textarea
          v-model="codeForm.code"
          class="native-code-input"
          :aria-label="t('Eklenecek kod')"
          rows="10"
          required
          spellcheck="false"
        ></textarea>
      </label>
      <p class="muted">{{ t('Kod, çalıştırılmadan metin olarak belgeye eklenir.') }}</p>
    </form>
    <template #footer
      ><button class="button" @click="close">{{ t('Vazgeç') }}</button
      ><button class="button primary" type="submit" form="code-form">
        {{ t('Kod bloğunu ekle') }}
      </button></template
    ></AppDialog
  >
</template>
