<script setup>
import { computed, defineAsyncComponent, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import {
  BookOpen,
  ChevronRight,
  CircleHelp,
  Code2,
  Copy,
  Download,
  Eye,
  FilePlus2,
  FileText,
  FolderOpen,
  HardDrive,
  Image,
  Layers2,
  LoaderCircle,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  Sparkles,
  Star,
  Tags,
  Trash2,
  Upload,
  X,
  Check,
  Circle,
} from '@lucide/vue'
import RichEditor from './components/RichEditor.vue'
import AppDialog from './components/AppDialog.vue'
import { useWorkspace } from './stores/workspace'
import { useMedia } from './stores/media'
import { cleanHtml, downloadHtml, renderDocument, plainText } from './lib/content'
import { createDocumentFilter, normalizeTags, searchKey } from './lib/document-library'
import { provideEditorLocale } from './lib/editor-locale'
import { workspaceLocale } from './lib/workspace-locale'

const locale = workspaceLocale
const { t } = provideEditorLocale({
  get locale() {
    return locale.value
  },
})

const SourceEditor = defineAsyncComponent(() => import('./components/SourceEditor.vue'))
const MediaManager = defineAsyncComponent(() => import('./components/MediaManager.vue'))
const WorkspaceBackup = defineAsyncComponent(() => import('./components/WorkspaceBackup.vue'))
const VersionHistory = defineAsyncComponent(() => import('./components/VersionHistory.vue'))
const DocumentTags = defineAsyncComponent(() => import('./components/DocumentTags.vue'))
const workspace = useWorkspace()
const media = useMedia()
const editor = ref(null)
const editorReady = ref(false)
const modal = ref(null)
const sidebarOpen = ref(false)
const detailsOpen = ref(false)
const search = ref('')
const favoritesOnly = ref(false)
const selectedTag = ref('')
const documentSort = ref('recent')
const filterDocuments = createDocumentFilter(plainText)
const favoriteCount = computed(() => workspace.documents.filter((item) => item.favorite).length)
const availableTags = computed(() => {
  const tags = new Map()
  for (const document of workspace.documents)
    for (const tag of normalizeTags(document.tags))
      if (!tags.has(searchKey(tag))) tags.set(searchKey(tag), tag)
  return [...tags.values()].sort((a, b) => a.localeCompare(b, locale.value))
})
const activeTags = computed(() => normalizeTags(workspace.active?.tags))
const hasFilters = computed(() => Boolean(search.value || favoritesOnly.value || selectedTag.value))
const importInput = ref(null)
const notice = ref('')
let noticeTimer
const filteredDocuments = computed(() =>
  filterDocuments(workspace.documents, {
    query: search.value,
    favorite: favoritesOnly.value,
    tag: selectedTag.value,
    sort: documentSort.value,
    locale: locale.value,
  }),
)
watch(availableTags, (tags) => {
  if (selectedTag.value && !tags.some((tag) => searchKey(tag) === selectedTag.value))
    selectedTag.value = ''
})
function resetFilters() {
  search.value = ''
  selectedTag.value = ''
  favoritesOnly.value = false
}
const updated = computed(() =>
  workspace.active
    ? new Date(workspace.active.updatedAt).toLocaleDateString(locale.value, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '',
)
const saveLabel = computed(() =>
  workspace.error
    ? 'Kayıt başarısız'
    : workspace.saving
      ? 'Kaydediliyor…'
      : workspace.dirty
        ? 'Kaydedilmeyi bekliyor'
        : 'Tüm değişiklikler kaydedildi',
)
const preview = computed(() => (workspace.active ? renderDocument(workspace.active) : ''))
watch(
  () => workspace.activeId,
  () => {
    editorReady.value = false
  },
)

function notify(text) {
  notice.value = text
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = ''
  }, 4000)
}
function editorInitialized() {
  editorReady.value = true
  workspace.update({ blockIds: editor.value.getDocument().blockIds })
}
async function action(callback) {
  try {
    await callback()
  } catch {
    notify('İşlem tamamlanamadı. Tarayıcınızın depolama alanını kontrol edin.')
  }
}
async function newDocument() {
  await action(() => workspace.create())
  if (!workspace.error) resetFilters()
  sidebarOpen.value = false
}
async function selectDocument(id) {
  await workspace.select(id)
  sidebarOpen.value = false
}
async function removeDocument(document) {
  if (
    window.confirm(
      t('“{title}” kalıcı olarak silinsin mi?', { title: document.title || t('Başlıksız belge') }),
    )
  )
    await action(() => workspace.remove(document.id))
}
function openMedia() {
  editor.value?.rememberSelection()
  modal.value = 'media'
  sidebarOpen.value = false
}
function insertMedia(item) {
  editor.value?.insert(media.markup(item))
  modal.value = null
  notify('Medya belgeye eklendi.')
}
function closeMedia() {
  modal.value = null
}
function applySource(content) {
  const cleaned = cleanHtml(content)
  editor.value?.replace(cleaned)
  modal.value = null
  notify('Kaynak kodu uygulandı.')
}
async function importHtml(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (file.size > 30 * 1024 * 1024) {
    notify('HTML dosyası en fazla 30 MB olabilir.')
    return
  }
  await action(async () => {
    const document = new DOMParser().parseFromString(await file.text(), 'text/html')
    await workspace.create(
      document.title || file.name.replace(/\.html?$/i, ''),
      cleanHtml(document.body.innerHTML),
    )
    if (!workspace.error) notify('HTML dosyası içe aktarıldı.')
    if (!workspace.error) resetFilters()
  })
  event.target.value = ''
}
function shortcut(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    workspace.save()
  }
}
function beforeUnload(event) {
  if (workspace.dirty || workspace.saving) {
    workspace.save()
    event.preventDefault()
    event.returnValue = ''
  }
}
onMounted(async () => {
  window.addEventListener('keydown', shortcut)
  window.addEventListener('beforeunload', beforeUnload)
  await Promise.all([workspace.initialize(), media.initialize()])
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', shortcut)
  window.removeEventListener('beforeunload', beforeUnload)
  clearTimeout(noticeTimer)
})
</script>

<template>
  <div class="studio">
    <button
      v-if="sidebarOpen"
      class="sidebar-overlay"
      :aria-label="t('Menüyü kapat')"
      @click="sidebarOpen = false"
    ></button>
    <aside class="sidebar" :class="{ 'is-open': sidebarOpen }">
      <a class="brand" href="./" :aria-label="t('Studio ana sayfa')"
        ><span class="brand-mark"><Layers2 :size="22" /></span> studio<span class="brand-dot"
          >.</span
        ></a
      >
      <div class="workspace-label">
        <span class="workspace-avatar">M</span>
        <div>
          <strong>{{ t('Benim çalışma alanım') }}</strong
          ><small>{{ t('Kişisel alan') }}</small>
        </div>
        <ChevronRight :size="15" />
      </div>
      <label class="workspace-language">
        <span>{{ t('Arayüz dili') }}</span>
        <select v-model="locale" :aria-label="t('Arayüz dili')">
          <option value="en" lang="en">English</option>
          <option value="tr" lang="tr">Türkçe</option>
        </select>
      </label>
      <button class="button primary new-document" :disabled="!workspace.ready" @click="newDocument">
        <Plus :size="17" /> {{ t('Yeni belge') }} <kbd>+</kbd>
      </button>
      <p class="nav-label">{{ t('ÇALIŞMA ALANI') }}</p>
      <button
        class="nav-item"
        :class="{ active: !favoritesOnly }"
        :aria-pressed="!favoritesOnly"
        @click="resetFilters()"
      >
        <FileText :size="18" /> {{ t('Belgelerim') }}
        <span class="nav-count">{{ workspace.documents.length }}</span>
      </button>
      <button
        class="nav-item"
        :class="{ active: favoritesOnly }"
        :aria-pressed="favoritesOnly"
        @click="favoritesOnly = !favoritesOnly"
      >
        <Star :size="18" /> {{ t('Favoriler') }} <span class="nav-count">{{ favoriteCount }}</span>
      </button>
      <button class="nav-item" :disabled="!editorReady" @click="openMedia()">
        <Image :size="18" /> {{ t('Medya kütüphanesi') }}
        <span class="nav-count">{{ media.items.length }}</span>
      </button>
      <div class="documents-heading">
        <p class="nav-label">{{ t('BELGELER') }}</p>
        <button
          class="icon-button"
          :aria-label="t('Yeni belge oluştur')"
          :disabled="!workspace.ready"
          @click="newDocument"
        >
          <Plus :size="16" />
        </button>
      </div>
      <label class="search-box sidebar-search"
        ><Search :size="15" /><input
          v-model="search"
          :placeholder="t('Başlık, içerik veya etiket…')"
          :aria-label="t('Belge ara')"
      /></label>
      <div class="document-filters">
        <label
          >{{ t('Etiket') }}
          <select v-model="selectedTag" :aria-label="t('Etikete göre filtrele')">
            <option value="">{{ t('Tüm etiketler') }}</option>
            <option v-for="tag in availableTags" :key="searchKey(tag)" :value="searchKey(tag)">
              {{ tag }}
            </option>
          </select>
        </label>
        <label
          >{{ t('Sıralama') }}
          <select v-model="documentSort" :aria-label="t('Belgeleri sırala')">
            <option value="recent">{{ t('Son düzenlenen') }}</option>
            <option value="oldest">{{ t('Önce eski düzenlenen') }}</option>
            <option value="title">{{ t('Başlık A–Z') }}</option>
            <option value="title-desc">{{ t('Başlık Z–A') }}</option>
          </select>
        </label>
      </div>
      <div v-if="hasFilters" class="document-filter-status">
        <span role="status">{{ filteredDocuments.length }} {{ t('belge bulundu') }}</span>
        <button class="text-button" @click="resetFilters">{{ t('Temizle') }}</button>
      </div>
      <nav class="document-list" :aria-label="t('Belgeler')">
        <div
          v-for="document in filteredDocuments"
          :key="document.id"
          class="document-row"
          :class="{ selected: workspace.activeId === document.id }"
        >
          <button
            class="document-select"
            :aria-current="workspace.activeId === document.id ? 'page' : undefined"
            @click="selectDocument(document.id)"
          >
            <Star
              v-if="document.favorite"
              class="favorite-star"
              :size="15"
              :aria-label="t('Favori')"
            /><FileText v-else :size="15" /><span>{{
              document.title || t('Başlıksız belge')
            }}</span>
          </button>
          <button
            class="icon-button delete-document"
            :aria-label="
              t('{title} belgesini sil', { title: document.title || t('Başlıksız belge') })
            "
            @click="removeDocument(document)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
        <p v-if="!filteredDocuments.length" class="muted no-documents">
          {{ workspace.ready ? t('Belge bulunamadı.') : t('Belgeler yükleniyor…') }}
        </p>
      </nav>
      <div class="sidebar-bottom">
        <button class="nav-item" :disabled="!workspace.ready" @click="modal = 'backup'">
          <HardDrive :size="17" /> {{ t('Yedekle / geri yükle') }}
        </button>
        <div class="local-note">
          <HardDrive :size="17" />
          <div>
            <strong>{{ t('Size ait bir alan') }}</strong>
            <p>{{ t('Belgeleriniz bu tarayıcıda saklanır. Yedeklemek için dışa aktarın.') }}</p>
          </div>
        </div>
        <button class="nav-item help-link" @click="modal = 'help'">
          <CircleHelp :size="17" /> {{ t('Kısa rehber') }} <span>↗</span>
        </button>
        <div class="profile">
          <span class="profile-avatar">M</span>
          <div>
            <strong>{{ t('Benim Studio’m') }}</strong
            ><small>{{ t('Yerel çalışma alanı') }}</small>
          </div>
          <span class="online-dot"></span>
        </div>
      </div>
    </aside>

    <main class="main-area">
      <header class="topbar">
        <div class="breadcrumb">
          <button
            class="icon-button mobile-menu"
            :aria-label="t('Menüyü aç')"
            @click="sidebarOpen = true"
          >
            <Menu :size="20" /></button
          ><FolderOpen :size="17" /><span>{{ t('Çalışma alanı') }}</span
          ><ChevronRight :size="14" /><strong>{{ t('Belgelerim') }}</strong>
        </div>
        <div class="topbar-right">
          <button class="button subtle import-button" @click="importInput?.click()">
            <Upload :size="16" /> {{ t('HTML içe aktar') }}
          </button>
          <span class="local-badge"><span></span> {{ t('Yerel çalışma alanı') }}</span
          ><button class="icon-button" :aria-label="t('Kısa rehber')" @click="modal = 'help'">
            <CircleHelp :size="19" />
          </button>
        </div>
      </header>
      <div v-if="!workspace.ready" class="loading-state">
        <LoaderCircle class="spin" :size="28" />
        <p>{{ t('Çalışma alanınız hazırlanıyor…') }}</p>
      </div>
      <div v-else-if="workspace.active" class="workspace-main">
        <input
          ref="importInput"
          type="file"
          accept=".html,.htm,text/html"
          hidden
          @change="importHtml"
        />
        <div v-if="workspace.error" class="error-banner" role="alert">
          {{ t(workspace.error) }}
          <button class="text-button" @click="workspace.save()">{{ t('Yeniden dene') }}</button>
        </div>
        <div class="document-heading">
          <div class="document-name">
            <span class="document-icon"><FileText :size="23" :stroke-width="1.5" /></span>
            <div>
              <input
                class="title-input"
                :aria-label="t('Belge başlığı')"
                :value="workspace.active.title"
                maxlength="160"
                :placeholder="t('Başlıksız belge')"
                @input="workspace.update({ title: $event.target.value })"
              />
              <div class="document-meta">
                <span class="draft-badge">{{ t('Taslak') }}</span
                ><span class="meta-dot">·</span><span>{{ updated }}</span>
                <button
                  class="document-favorite"
                  :class="{ 'is-favorite': workspace.active.favorite }"
                  :aria-label="
                    workspace.active.favorite ? t('Favorilerden çıkar') : t('Favorilere ekle')
                  "
                  :title="
                    workspace.active.favorite ? t('Favorilerden çıkar') : t('Favorilere ekle')
                  "
                  :aria-pressed="Boolean(workspace.active.favorite)"
                  @click="workspace.update({ favorite: !workspace.active.favorite })"
                >
                  <Star :size="15" />
                </button>
                <button
                  class="document-tags-button"
                  @click="modal = 'tags'"
                  :aria-label="t('Belge etiketlerini düzenle')"
                >
                  <Tags :size="14" />
                  {{
                    activeTags.length
                      ? t('{count} etiket', { count: activeTags.length })
                      : t('Etiket ekle')
                  }}
                </button>
              </div>
            </div>
          </div>
          <div class="document-actions">
            <button class="button" :disabled="!editorReady" @click="modal = 'versions'">
              {{ t('Sürümler') }}
            </button>
            <button
              class="button"
              :aria-label="t('Kaynak kodu')"
              :disabled="!editorReady"
              @click="modal = 'source'"
            >
              <Code2 :size="17" /><span>{{ t('Kaynak kodu') }}</span>
            </button>
            <button class="button" :disabled="!editorReady" @click="modal = 'preview'">
              <Eye :size="16" /><span>{{ t('Önizleme') }}</span></button
            ><button class="button primary" @click="downloadHtml(workspace.active)">
              <Download :size="16" /><span>{{ t('Dışa aktar') }}</span>
            </button>
            <button
              class="icon-button details-toggle"
              :aria-label="
                detailsOpen ? t('Belge ayrıntılarını gizle') : t('Belge ayrıntılarını göster')
              "
              :title="
                detailsOpen ? t('Belge ayrıntılarını gizle') : t('Belge ayrıntılarını göster')
              "
              :aria-pressed="detailsOpen"
              @click="detailsOpen = !detailsOpen"
            >
              <PanelRightClose v-if="detailsOpen" :size="19" /><PanelRightOpen v-else :size="19" />
            </button>
          </div>
        </div>
        <div class="editor-layout" :class="{ 'without-details': !detailsOpen }">
          <section class="editor-card" :aria-label="t('Belge düzenleyici')">
            <div class="editor-surface">
              <RichEditor
                :locale="locale"
                :key="workspace.activeId"
                ref="editor"
                :model-value="workspace.active.content"
                :block-ids="workspace.active.blockIds"
                @transaction="workspace.update({ blockIds: $event.blockIdsAfter })"
                @update:model-value="workspace.update({ content: $event })"
                @media="openMedia"
                @source="modal = 'source'"
                @save="workspace.save()"
                @ready="editorInitialized"
              />
            </div>
            <footer class="editor-status">
              <span class="save-state" :class="{ 'has-error': workspace.error }" role="status"
                ><LoaderCircle v-if="workspace.saving" :size="13" class="spin" /><Circle
                  v-else-if="workspace.dirty || workspace.error"
                  :size="9"
                /><Check v-else :size="14" />{{ t(saveLabel) }}</span
              ><span
                >{{ workspace.words }} {{ t('kelime') }} <i>·</i> {{ workspace.characters }}
                {{ t('karakter') }}</span
              >
            </footer>
          </section>
          <aside v-if="detailsOpen" class="inspector">
            <div class="inspector-heading">
              <h2>{{ t('Belge ayrıntıları') }}</h2>
              <button
                class="icon-button"
                :aria-label="t('Ayrıntıları kapat')"
                @click="detailsOpen = false"
              >
                <X :size="15" />
              </button>
            </div>
            <div class="detail-section">
              <span class="section-label">{{ t('GENEL BAKIŞ') }}</span>
              <dl>
                <div>
                  <dt>{{ t('Durum') }}</dt>
                  <dd>
                    <span class="draft-badge">{{ t('Taslak') }}</span>
                  </dd>
                </div>
                <div>
                  <dt>{{ t('Kelime') }}</dt>
                  <dd>{{ workspace.words }}</dd>
                </div>
                <div>
                  <dt>{{ t('Okuma süresi') }}</dt>
                  <dd>{{ Math.max(1, Math.ceil(workspace.words / 200)) }} {{ t('dk') }}</dd>
                </div>
                <div>
                  <dt>{{ t('Biçim') }}</dt>
                  <dd>HTML</dd>
                </div>
              </dl>
            </div>
            <div class="detail-section">
              <span class="section-label">{{ t('HIZLI İŞLEMLER') }}</span
              ><button class="quick-action" :disabled="!editorReady" @click="openMedia()">
                <Image :size="17" /><span>{{ t('Medya ekle') }}</span
                ><Plus :size="15" /></button
              ><button class="quick-action" :disabled="!editorReady" @click="modal = 'source'">
                <Code2 :size="17" /><span>{{ t('Kaynak kodunu düzenle') }}</span
                ><ChevronRight :size="14" /></button
              ><button
                class="quick-action"
                @click="
                  action(() =>
                    workspace.create(
                      t('{title} — kopya', { title: workspace.active.title }),
                      workspace.active.content,
                      { tags: workspace.active.tags },
                    ),
                  )
                "
              >
                <Copy :size="16" /><span>{{ t('Belgeyi çoğalt') }}</span
                ><ChevronRight :size="14" />
              </button>
            </div>
            <div class="inspiration">
              <span class="inspiration-icon"><Sparkles :size="19" /></span>
              <h3>{{ t('Kelimeler sizin,') }}<br />{{ t('olasılıklar sınırsız.') }}</h3>
              <p>
                {{
                  t('Görseller, tablolar ve kod bloklarıyla içeriğinizi bir adım ileri taşıyın.')
                }}
              </p>
              <button @click="modal = 'help'">{{ t('Editörü keşfedin') }} <span>↗</span></button>
            </div>
            <div class="autosave-note">
              <span class="online-dot"></span>
              <p>
                {{ t('Otomatik kayıt açık') }}<br /><small>{{
                  t('Değişiklikleriniz siz yazdıkça saklanır.')
                }}</small>
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>

    <MediaManager v-if="modal === 'media'" @close="closeMedia" @insert="insertMedia" />
    <WorkspaceBackup v-if="modal === 'backup'" @close="modal = null" />
    <VersionHistory v-if="modal === 'versions'" @close="modal = null" />
    <DocumentTags
      v-if="modal === 'tags' && workspace.active"
      :document="workspace.active"
      @update="workspace.update"
      @close="modal = null"
    />
    <SourceEditor
      v-if="modal === 'source'"
      :content="workspace.active.content"
      @close="modal = null"
      @apply="applySource"
    />
    <AppDialog
      v-if="modal === 'preview'"
      :title="workspace.active.title || 'Önizleme'"
      wide
      @close="modal = null"
      ><template #eyebrow
        ><span class="eyebrow">{{ t('BELGE ÖNİZLEMESİ') }}</span></template
      ><iframe
        class="preview-frame"
        :title="t('Belge önizlemesi')"
        sandbox=""
        :srcdoc="preview"
      ></iframe
      ><template #footer
        ><span class="muted footer-note"
          >{{ workspace.words }} {{ t('kelime ·') }}
          {{ Math.max(1, Math.ceil(workspace.words / 200)) }} {{ t('dk okuma') }}</span
        ><button class="button primary" @click="downloadHtml(workspace.active)">
          <Download :size="16" /> {{ t('HTML indir') }}
        </button></template
      ></AppDialog
    >
    <AppDialog v-if="modal === 'help'" :title="t('Studio ile tanışın')" @close="modal = null"
      ><template #eyebrow
        ><span class="eyebrow">{{ t('KÜÇÜK BİR REHBER') }}</span></template
      >
      <div class="help-content">
        <div>
          <FilePlus2 />
          <section>
            <h3>{{ t('Yazmaya başlayın') }}</h3>
            <p>
              {{
                t(
                  'Yeni belge oluşturun veya bir HTML dosyasını içe aktarın. Başlığı üstteki alandan değiştirebilirsiniz. Boş paragrafta / ile blok menüsünü açın; ## ve boşlukla başlık oluşturun. Soldaki tutamakla blokları sürükleyin veya ok tuşlarıyla taşıyın.',
                )
              }}
            </p>
          </section>
        </div>
        <div>
          <Image />
          <section>
            <h3>{{ t('Dosyalarınıza bir yuva') }}</h3>
            <p>
              {{
                t(
                  'Medya kütüphanesine görsel, video, ses ve PDF yükleyin. Dosyayı seçip “Belgeye ekle” düğmesine basın. Görsele çift tıklayarak kırpın, döndürün, rengini ayarlayın ve PNG, JPEG veya WebP olarak uygulayın.',
                )
              }}
            </p>
          </section>
        </div>
        <div>
          <Code2 />
          <section>
            <h3>{{ t('Kodun kontrolü sizde') }}</h3>
            <p>
              {{
                t(
                  'Kaynak kodu editöründe renklendirme, otomatik tamamlama, satır numaraları ve Ctrl / ⌘ + F ile arama bulunur. Düzenlemeyi bitirdiğinizde değişiklikleri uygulayın.',
                )
              }}
            </p>
          </section>
        </div>
        <div>
          <HardDrive />
          <section>
            <h3>{{ t('Çalışmanızı koruyun') }}</h3>
            <p>
              {{
                t(
                  'Sürümler düğmesiyle önceki kayıtları karşılaştırıp geri yükleyin. Yan menüdeki “Yedekle / geri yükle” belgeleri, yorumları, medyayı, şablonları ve sürümleri tek dosyada saklar. Dosya menüsünden sayfa düzeni, PDF yazdırma ve DOCX çıktısına ulaşın.',
                )
              }}
            </p>
          </section>
        </div>
        <p class="shortcut-note">
          <kbd>Ctrl / ⌘</kbd> + <kbd>S</kbd> {{ t('hemen kaydet') }} <span>·</span>
          <kbd>Ctrl / ⌘</kbd> + <kbd>Z</kbd> {{ t('geri al') }}
        </p>
      </div>
      <template #footer
        ><button class="button primary" @click="modal = null">
          <BookOpen :size="16" /> {{ t('Yazmaya başlayalım') }}
        </button></template
      ></AppDialog
    >
    <div v-if="notice" class="toast" role="status">
      <Check :size="17" />{{ t(notice)
      }}<button class="icon-button" :aria-label="t('Bildirimi kapat')" @click="notice = ''">
        <X :size="15" />
      </button>
    </div>
  </div>
</template>
