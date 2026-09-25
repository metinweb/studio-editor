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
  return [...tags.values()].sort((a, b) => a.localeCompare(b, 'tr'))
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
    ? new Date(workspace.active.updatedAt).toLocaleDateString('tr-TR', {
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
  if (window.confirm(`“${document.title || 'Başlıksız belge'}” kalıcı olarak silinsin mi?`))
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
      aria-label="Menüyü kapat"
      @click="sidebarOpen = false"
    ></button>
    <aside class="sidebar" :class="{ 'is-open': sidebarOpen }">
      <a class="brand" href="./" aria-label="Studio ana sayfa"
        ><span class="brand-mark"><Layers2 :size="22" /></span> studio<span class="brand-dot"
          >.</span
        ></a
      >
      <div class="workspace-label">
        <span class="workspace-avatar">M</span>
        <div><strong>Benim çalışma alanım</strong><small>Kişisel alan</small></div>
        <ChevronRight :size="15" />
      </div>
      <button class="button primary new-document" :disabled="!workspace.ready" @click="newDocument">
        <Plus :size="17" /> Yeni belge <kbd>+</kbd>
      </button>
      <p class="nav-label">ÇALIŞMA ALANI</p>
      <button
        class="nav-item"
        :class="{ active: !favoritesOnly }"
        :aria-pressed="!favoritesOnly"
        @click="resetFilters()"
      >
        <FileText :size="18" /> Belgelerim
        <span class="nav-count">{{ workspace.documents.length }}</span>
      </button>
      <button
        class="nav-item"
        :class="{ active: favoritesOnly }"
        :aria-pressed="favoritesOnly"
        @click="favoritesOnly = !favoritesOnly"
      >
        <Star :size="18" /> Favoriler
        <span class="nav-count">{{ favoriteCount }}</span>
      </button>
      <button class="nav-item" :disabled="!editorReady" @click="openMedia()">
        <Image :size="18" /> Medya kütüphanesi
        <span class="nav-count">{{ media.items.length }}</span>
      </button>
      <div class="documents-heading">
        <p class="nav-label">BELGELER</p>
        <button
          class="icon-button"
          aria-label="Yeni belge oluştur"
          :disabled="!workspace.ready"
          @click="newDocument"
        >
          <Plus :size="16" />
        </button>
      </div>
      <label class="search-box sidebar-search"
        ><Search :size="15" /><input
          v-model="search"
          placeholder="Başlık, içerik veya etiket…"
          aria-label="Belge ara"
      /></label>
      <div class="document-filters">
        <label
          >Etiket
          <select v-model="selectedTag" aria-label="Etikete göre filtrele">
            <option value="">Tüm etiketler</option>
            <option v-for="tag in availableTags" :key="searchKey(tag)" :value="searchKey(tag)">
              {{ tag }}
            </option>
          </select>
        </label>
        <label
          >Sıralama
          <select v-model="documentSort" aria-label="Belgeleri sırala">
            <option value="recent">Son düzenlenen</option>
            <option value="oldest">Önce eski düzenlenen</option>
            <option value="title">Başlık A–Z</option>
            <option value="title-desc">Başlık Z–A</option>
          </select>
        </label>
      </div>
      <div v-if="hasFilters" class="document-filter-status">
        <span role="status">{{ filteredDocuments.length }} belge bulundu</span>
        <button class="text-button" @click="resetFilters">Temizle</button>
      </div>
      <nav class="document-list" aria-label="Belgeler">
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
              aria-label="Favori"
            /><FileText v-else :size="15" /><span>{{ document.title || 'Başlıksız belge' }}</span>
          </button>
          <button
            class="icon-button delete-document"
            :aria-label="`${document.title || 'Başlıksız belge'} belgesini sil`"
            @click="removeDocument(document)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
        <p v-if="!filteredDocuments.length" class="muted no-documents">
          {{ workspace.ready ? 'Belge bulunamadı.' : 'Belgeler yükleniyor…' }}
        </p>
      </nav>
      <div class="sidebar-bottom">
        <button class="nav-item" :disabled="!workspace.ready" @click="modal = 'backup'">
          <HardDrive :size="17" /> Yedekle / geri yükle
        </button>
        <div class="local-note">
          <HardDrive :size="17" />
          <div>
            <strong>Size ait bir alan</strong>
            <p>Belgeleriniz bu tarayıcıda saklanır. Yedeklemek için dışa aktarın.</p>
          </div>
        </div>
        <button class="nav-item help-link" @click="modal = 'help'">
          <CircleHelp :size="17" /> Kısa rehber <span>↗</span>
        </button>
        <div class="profile">
          <span class="profile-avatar">M</span>
          <div><strong>Benim Studio’m</strong><small>Yerel çalışma alanı</small></div>
          <span class="online-dot"></span>
        </div>
      </div>
    </aside>

    <main class="main-area">
      <header class="topbar">
        <div class="breadcrumb">
          <button
            class="icon-button mobile-menu"
            aria-label="Menüyü aç"
            @click="sidebarOpen = true"
          >
            <Menu :size="20" /></button
          ><FolderOpen :size="17" /><span>Çalışma alanı</span><ChevronRight :size="14" /><strong
            >Belgelerim</strong
          >
        </div>
        <div class="topbar-right">
          <button class="button subtle import-button" @click="importInput?.click()">
            <Upload :size="16" /> HTML içe aktar
          </button>
          <span class="local-badge"><span></span> Yerel çalışma alanı</span
          ><button class="icon-button" aria-label="Kısa rehber" @click="modal = 'help'">
            <CircleHelp :size="19" />
          </button>
        </div>
      </header>
      <div v-if="!workspace.ready" class="loading-state">
        <LoaderCircle class="spin" :size="28" />
        <p>Çalışma alanınız hazırlanıyor…</p>
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
          {{ workspace.error }}
          <button class="text-button" @click="workspace.save()">Yeniden dene</button>
        </div>
        <div class="document-heading">
          <div class="document-name">
            <span class="document-icon"><FileText :size="23" :stroke-width="1.5" /></span>
            <div>
              <input
                class="title-input"
                aria-label="Belge başlığı"
                :value="workspace.active.title"
                maxlength="160"
                placeholder="Başlıksız belge"
                @input="workspace.update({ title: $event.target.value })"
              />
              <div class="document-meta">
                <span class="draft-badge">Taslak</span><span class="meta-dot">·</span
                ><span>{{ updated }}</span>
                <button
                  class="document-favorite"
                  :class="{ 'is-favorite': workspace.active.favorite }"
                  :aria-label="workspace.active.favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'"
                  :title="workspace.active.favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'"
                  :aria-pressed="Boolean(workspace.active.favorite)"
                  @click="workspace.update({ favorite: !workspace.active.favorite })"
                >
                  <Star :size="15" />
                </button>
                <button
                  class="document-tags-button"
                  @click="modal = 'tags'"
                  aria-label="Belge etiketlerini düzenle"
                >
                  <Tags :size="14" />
                  {{ activeTags.length ? `${activeTags.length} etiket` : 'Etiket ekle' }}
                </button>
              </div>
            </div>
          </div>
          <div class="document-actions">
            <button class="button" :disabled="!editorReady" @click="modal = 'versions'">
              Sürümler
            </button>
            <button
              class="button"
              aria-label="Kaynak kodu"
              :disabled="!editorReady"
              @click="modal = 'source'"
            >
              <Code2 :size="17" /><span>Kaynak kodu</span>
            </button>
            <button class="button" :disabled="!editorReady" @click="modal = 'preview'">
              <Eye :size="16" /><span>Önizleme</span></button
            ><button class="button primary" @click="downloadHtml(workspace.active)">
              <Download :size="16" /><span>Dışa aktar</span>
            </button>
            <button
              class="icon-button details-toggle"
              :aria-label="detailsOpen ? 'Belge ayrıntılarını gizle' : 'Belge ayrıntılarını göster'"
              :title="detailsOpen ? 'Belge ayrıntılarını gizle' : 'Belge ayrıntılarını göster'"
              :aria-pressed="detailsOpen"
              @click="detailsOpen = !detailsOpen"
            >
              <PanelRightClose v-if="detailsOpen" :size="19" /><PanelRightOpen v-else :size="19" />
            </button>
          </div>
        </div>
        <div class="editor-layout" :class="{ 'without-details': !detailsOpen }">
          <section class="editor-card" aria-label="Belge düzenleyici">
            <div class="editor-surface">
              <RichEditor
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
                /><Check v-else :size="14" />{{ saveLabel }}</span
              ><span
                >{{ workspace.words }} kelime <i>·</i> {{ workspace.characters }} karakter</span
              >
            </footer>
          </section>
          <aside v-if="detailsOpen" class="inspector">
            <div class="inspector-heading">
              <h2>Belge ayrıntıları</h2>
              <button
                class="icon-button"
                aria-label="Ayrıntıları kapat"
                @click="detailsOpen = false"
              >
                <X :size="15" />
              </button>
            </div>
            <div class="detail-section">
              <span class="section-label">GENEL BAKIŞ</span>
              <dl>
                <div>
                  <dt>Durum</dt>
                  <dd><span class="draft-badge">Taslak</span></dd>
                </div>
                <div>
                  <dt>Kelime</dt>
                  <dd>{{ workspace.words }}</dd>
                </div>
                <div>
                  <dt>Okuma süresi</dt>
                  <dd>{{ Math.max(1, Math.ceil(workspace.words / 200)) }} dk</dd>
                </div>
                <div>
                  <dt>Biçim</dt>
                  <dd>HTML</dd>
                </div>
              </dl>
            </div>
            <div class="detail-section">
              <span class="section-label">HIZLI İŞLEMLER</span
              ><button class="quick-action" :disabled="!editorReady" @click="openMedia()">
                <Image :size="17" /><span>Medya ekle</span><Plus :size="15" /></button
              ><button class="quick-action" :disabled="!editorReady" @click="modal = 'source'">
                <Code2 :size="17" /><span>Kaynak kodunu düzenle</span
                ><ChevronRight :size="14" /></button
              ><button
                class="quick-action"
                @click="
                  action(() =>
                    workspace.create(
                      `${workspace.active.title} — kopya`,
                      workspace.active.content,
                      { tags: workspace.active.tags },
                    ),
                  )
                "
              >
                <Copy :size="16" /><span>Belgeyi çoğalt</span><ChevronRight :size="14" />
              </button>
            </div>
            <div class="inspiration">
              <span class="inspiration-icon"><Sparkles :size="19" /></span>
              <h3>Kelimeler sizin,<br />olasılıklar sınırsız.</h3>
              <p>Görseller, tablolar ve kod bloklarıyla içeriğinizi bir adım ileri taşıyın.</p>
              <button @click="modal = 'help'">Editörü keşfedin <span>↗</span></button>
            </div>
            <div class="autosave-note">
              <span class="online-dot"></span>
              <p>
                Otomatik kayıt açık<br /><small>Değişiklikleriniz siz yazdıkça saklanır.</small>
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
      ><template #eyebrow><span class="eyebrow">BELGE ÖNİZLEMESİ</span></template
      ><iframe class="preview-frame" title="Belge önizlemesi" sandbox="" :srcdoc="preview"></iframe
      ><template #footer
        ><span class="muted footer-note"
          >{{ workspace.words }} kelime · {{ Math.max(1, Math.ceil(workspace.words / 200)) }} dk
          okuma</span
        ><button class="button primary" @click="downloadHtml(workspace.active)">
          <Download :size="16" /> HTML indir
        </button></template
      ></AppDialog
    >
    <AppDialog v-if="modal === 'help'" title="Studio ile tanışın" @close="modal = null"
      ><template #eyebrow><span class="eyebrow">KÜÇÜK BİR REHBER</span></template>
      <div class="help-content">
        <div>
          <FilePlus2 />
          <section>
            <h3>Yazmaya başlayın</h3>
            <p>
              Yeni belge oluşturun veya bir HTML dosyasını içe aktarın. Başlığı üstteki alandan
              değiştirebilirsiniz. Boş paragrafta / ile blok menüsünü açın; ## ve boşlukla başlık
              oluşturun. Soldaki tutamakla blokları sürükleyin veya ok tuşlarıyla taşıyın.
            </p>
          </section>
        </div>
        <div>
          <Image />
          <section>
            <h3>Dosyalarınıza bir yuva</h3>
            <p>
              Medya kütüphanesine görsel, video, ses ve PDF yükleyin. Dosyayı seçip “Belgeye ekle”
              düğmesine basın. Görsele çift tıklayarak kırpın, döndürün, rengini ayarlayın ve PNG,
              JPEG veya WebP olarak uygulayın.
            </p>
          </section>
        </div>
        <div>
          <Code2 />
          <section>
            <h3>Kodun kontrolü sizde</h3>
            <p>
              Kaynak kodu editöründe renklendirme, otomatik tamamlama, satır numaraları ve Ctrl / ⌘
              + F ile arama bulunur. Düzenlemeyi bitirdiğinizde değişiklikleri uygulayın.
            </p>
          </section>
        </div>
        <div>
          <HardDrive />
          <section>
            <h3>Çalışmanızı koruyun</h3>
            <p>
              Sürümler düğmesiyle önceki kayıtları karşılaştırıp geri yükleyin. Yan menüdeki
              “Yedekle / geri yükle” belgeleri, yorumları, medyayı, şablonları ve sürümleri tek
              dosyada saklar. Dosya menüsünden sayfa düzeni, PDF yazdırma ve DOCX çıktısına ulaşın.
            </p>
          </section>
        </div>
        <p class="shortcut-note">
          <kbd>Ctrl / ⌘</kbd> + <kbd>S</kbd> hemen kaydet <span>·</span> <kbd>Ctrl / ⌘</kbd> +
          <kbd>Z</kbd> geri al
        </p>
      </div>
      <template #footer
        ><button class="button primary" @click="modal = null">
          <BookOpen :size="16" /> Yazmaya başlayalım
        </button></template
      ></AppDialog
    >
    <div v-if="notice" class="toast" role="status">
      <Check :size="17" />{{ notice
      }}<button class="icon-button" aria-label="Bildirimi kapat" @click="notice = ''">
        <X :size="15" />
      </button>
    </div>
  </div>
</template>
