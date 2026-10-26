<script setup>
import {
  Undo2,
  Redo2,
  List,
  ListOrdered,
  IndentIncrease,
  IndentDecrease,
  Link,
  Image,
  Table2,
  Search,
  Maximize2,
  Minimize2,
  RemoveFormatting,
  X,
  ChevronDown,
  MessageSquare,
  LayoutTemplate,
  ScanEye,
  Paintbrush,
  ListTree,
  Ellipsis,
  Film,
  FlaskConical,
  ListChecks,
  Palette,
  Superscript,
  FileUp,
  Bookmark,
  Braces,
  Eye,
  Printer,
  Workflow,
  GitCompareArrows,
} from '@lucide/vue'
import { useEditorLocale } from '../../lib/editor-locale'
import { alignButtons, markButtons } from './options.js'
import { toolbarKeys, keepSelection } from './keyboard.js'
import { useRichEditor } from './context.js'

const { t } = useEditorLocale()
const {
  tools,
  allowed,
  firstRow,
  secondRow,
  toolbarExpanded,
  state,
  popup,
  togglePopup,
  command,
  openDialog,
  openPreview,
  dialog,
  blockLabel,
  fontLabel,
  foreground,
  background,
  outlineOpen,
  searchOpen,
  fullscreen,
  openMedia,
  openEmbed,
  openScience,
  openDiagram,
  reviewTab,
  openReview,
  commentCount,
  format,
  pasteFormat,
} = useRichEditor()
</script>

<template>
  <div
    v-if="firstRow || secondRow"
    class="native-toolbar"
    :class="{ 'toolbar-expanded': toolbarExpanded }"
    role="toolbar"
    :aria-label="t('Biçimlendirme araçları')"
    @keydown="toolbarKeys"
  >
    <div v-if="firstRow" class="native-toolbar-row">
      <div v-if="tools('history')" class="native-tool-group">
        <button
          class="native-tool"
          :aria-label="t('Geri al')"
          :title="t('Geri al · Ctrl / ⌘ + Z')"
          :disabled="!state.canUndo"
          @pointerdown="keepSelection"
          @click="command('undo')"
        >
          <Undo2 :size="17" />
        </button>
        <button
          class="native-tool"
          :aria-label="t('Yinele')"
          :title="t('Yinele · Ctrl / ⌘ + Shift + Z')"
          :disabled="!state.canRedo"
          @pointerdown="keepSelection"
          @click="command('redo')"
        >
          <Redo2 :size="17" />
        </button>
      </div>
      <div v-if="tools('insert')" class="native-tool-group native-document-tools">
        <button
          v-if="allowed('wordImport')"
          class="native-tool"
          :aria-label="t('Word dosyası içe aktar')"
          :title="t('Word dosyası içe aktar')"
          @pointerdown="keepSelection"
          @click="openDialog('importWord')"
        >
          <FileUp :size="17" />
        </button>
        <button
          class="native-tool"
          :aria-label="t('Belge önizlemesi')"
          :title="t('Belge önizlemesi')"
          @pointerdown="keepSelection"
          @click="openPreview"
        >
          <Eye :size="17" />
        </button>
        <button
          class="native-tool"
          :aria-label="t('Yazdır / PDF')"
          :title="t('Yazdır / PDF')"
          @pointerdown="keepSelection"
          @click="dialog = 'print'"
        >
          <Printer :size="17" />
        </button>
      </div>
      <div v-if="tools('typography')" class="native-tool-group">
        <button
          class="native-menu-select block-select"
          :aria-label="`${t('Paragraf biçimi')}: ${t(blockLabel)}`"
          aria-haspopup="menu"
          :aria-expanded="popup === 'blocks'"
          @pointerdown="keepSelection"
          @click="togglePopup('blocks', $event)"
          @keydown.down.prevent="togglePopup('blocks', $event)"
        >
          <span>{{ t(blockLabel) }}</span
          ><ChevronDown :size="14" />
        </button>
        <button
          class="native-menu-select font-select"
          :aria-label="`${t('Yazı tipi')}: ${fontLabel}`"
          aria-haspopup="menu"
          :aria-expanded="popup === 'fonts'"
          @pointerdown="keepSelection"
          @click="togglePopup('fonts', $event)"
          @keydown.down.prevent="togglePopup('fonts', $event)"
        >
          <span>{{ fontLabel }}</span
          ><ChevronDown :size="14" />
        </button>
        <button
          class="native-menu-select size-select"
          :aria-label="`${t('Yazı boyutu')}: ${parseFloat(state.fontSize || '16')} px`"
          aria-haspopup="menu"
          :aria-expanded="popup === 'sizes'"
          @pointerdown="keepSelection"
          @click="togglePopup('sizes', $event)"
          @keydown.down.prevent="togglePopup('sizes', $event)"
        >
          <span>{{ parseFloat(state.fontSize || '16') }} px</span><ChevronDown :size="14" />
        </button>
      </div>
      <div v-if="tools('format') || tools('color')" class="native-tool-group">
        <button
          v-for="tool in tools('format') ? markButtons : []"
          :key="tool.command"
          class="native-tool"
          :aria-label="t(tool.title)"
          :title="t(tool.title)"
          :aria-pressed="!!state[tool.command]"
          @pointerdown="keepSelection"
          @click="command('inline', tool.command)"
        >
          <component :is="tool.icon" :size="17" />
        </button>
        <button
          v-if="tools('color')"
          class="native-color"
          :title="t('Metin rengi')"
          :aria-label="t('Metin rengi')"
          aria-haspopup="menu"
          :aria-expanded="popup === 'foreground'"
          @pointerdown="keepSelection"
          @click="togglePopup('foreground', $event)"
        >
          <span :style="{ borderColor: foreground }">A</span><ChevronDown :size="11" />
        </button>
        <button
          v-if="tools('color')"
          class="native-color"
          :title="t('Vurgu rengi')"
          :aria-label="t('Vurgu rengi')"
          aria-haspopup="menu"
          :aria-expanded="popup === 'highlight'"
          @pointerdown="keepSelection"
          @click="togglePopup('highlight', $event)"
        >
          <span :style="{ borderColor: background }" class="highlight-letter">A</span
          ><ChevronDown :size="11" />
        </button>
      </div>
    </div>
    <div v-if="secondRow" class="native-toolbar-row">
      <div v-if="tools('align')" class="native-tool-group">
        <button
          v-for="tool in alignButtons"
          :key="tool.value"
          class="native-tool"
          :aria-label="t(tool.title)"
          :title="t(tool.title)"
          :aria-pressed="state.align === tool.value"
          @pointerdown="keepSelection"
          @click="command('align', tool.value)"
        >
          <component :is="tool.icon" :size="17" />
        </button>
      </div>
      <div v-if="tools('lists')" class="native-tool-group">
        <div
          v-for="tag in ['ul', 'ol']"
          :key="tag"
          class="native-list-split"
          :class="{ active: state.list === tag && !state.taskList }"
        >
          <button
            class="native-tool"
            :aria-label="t(tag === 'ul' ? 'Madde işaretli liste' : 'Numaralı liste')"
            :title="t(tag === 'ul' ? 'Madde işaretli liste' : 'Numaralı liste')"
            :aria-pressed="state.list === tag && !state.taskList"
            @pointerdown="keepSelection"
            @click="command('list', tag)"
          >
            <component :is="tag === 'ul' ? List : ListOrdered" :size="17" />
          </button>
          <button
            class="native-tool native-list-arrow"
            :aria-label="t(tag === 'ul' ? 'Madde işareti stilleri' : 'Numaralandırma stilleri')"
            :title="t(tag === 'ul' ? 'Madde işareti stilleri' : 'Numaralandırma stilleri')"
            aria-haspopup="menu"
            :aria-expanded="popup === (tag === 'ul' ? 'bulletStyles' : 'numberStyles')"
            @pointerdown="keepSelection"
            @click="togglePopup(tag === 'ul' ? 'bulletStyles' : 'numberStyles', $event)"
          >
            <ChevronDown :size="12" />
          </button>
        </div>
        <button
          class="native-tool"
          :aria-label="t('Girintiyi artır')"
          :title="t('Liste girintisini artır · Tab')"
          :disabled="!state.block"
          @pointerdown="keepSelection"
          @click="command('indent')"
        >
          <IndentIncrease :size="17" />
        </button>
        <button
          class="native-tool"
          :aria-label="t('Girintiyi azalt')"
          :title="t('Liste girintisini azalt · Shift + Tab')"
          :disabled="!state.block"
          @pointerdown="keepSelection"
          @click="command('indent', true)"
        >
          <IndentDecrease :size="17" />
        </button>
      </div>
      <div v-if="tools('insert')" class="native-tool-group">
        <button
          class="native-tool"
          :aria-label="t('Bağlantı ekle')"
          v-if="allowed('links')"
          :title="t('Bağlantı ekle veya düzenle')"
          :aria-pressed="!!state.link"
          @pointerdown="keepSelection"
          @click="openDialog('link')"
        >
          <Link :size="17" />
        </button>
        <button
          class="native-tool"
          :aria-label="t('Medya kütüphanesini aç')"
          v-if="allowed('media')"
          :title="t('Medya kütüphanesi')"
          @pointerdown="keepSelection"
          @click="openMedia"
        >
          <Image :size="17" />
        </button>
        <button
          class="native-tool native-table-button"
          v-if="allowed('tables')"
          :aria-label="t('Tablo ekle')"
          :aria-expanded="popup === 'table'"
          :title="t('Tablo ekle')"
          @pointerdown="keepSelection"
          @click="togglePopup('table', $event)"
        >
          <Table2 :size="17" /><ChevronDown :size="12" />
        </button>
        <button
          class="native-tool"
          :aria-label="t('Bağlantıdan medya ekle')"
          v-if="allowed('media')"
          :title="t('YouTube / Vimeo')"
          @pointerdown="keepSelection"
          @click="openEmbed()"
        >
          <Film :size="17" />
        </button>
        <button
          class="native-tool"
          :aria-label="t('Matematik ve kimya')"
          v-if="allowed('science')"
          :title="t('Matematik ve kimya')"
          @pointerdown="keepSelection"
          @click="openScience()"
        >
          <FlaskConical :size="17" />
        </button>
        <button
          class="native-tool"
          :aria-label="t('Diyagram (Mermaid)')"
          v-if="allowed('diagrams')"
          :title="t('Diyagram (Mermaid)')"
          @pointerdown="keepSelection"
          @click="openDiagram()"
        >
          <Workflow :size="17" />
        </button>
      </div>
      <div v-if="tools('insert')" class="native-tool-group">
        <button
          class="native-tool"
          :aria-label="t('Bağlantı hedefleri')"
          :title="t('Bağlantı hedefleri')"
          @pointerdown="keepSelection"
          @click="openDialog('anchor')"
        >
          <Bookmark :size="17" />
        </button>
        <button
          class="native-tool"
          :aria-label="t('Dipnotlar')"
          :title="t('Dipnotlar')"
          @pointerdown="keepSelection"
          @click="openDialog('footnote')"
        >
          <Superscript :size="17" />
        </button>
        <button
          class="native-tool"
          :aria-label="t('Şablon değişkenleri')"
          :title="t('Şablon değişkenleri')"
          @pointerdown="keepSelection"
          @click="openDialog('fields')"
        >
          <Braces :size="17" />
        </button>
      </div>
      <div v-if="tools('tools')" class="native-tool-group">
        <button
          class="native-tool native-menu-button"
          :aria-label="t('İçerik stilleri')"
          :title="t('İçerik stilleri')"
          :aria-expanded="popup === 'contentStyles'"
          @pointerdown="keepSelection"
          @click="togglePopup('contentStyles', $event)"
        >
          <Palette :size="17" /><ChevronDown :size="12" />
        </button>
        <button
          class="native-tool"
          :aria-label="t('Belge başlıkları')"
          :title="t('Belge başlıkları')"
          :aria-pressed="outlineOpen"
          @pointerdown="keepSelection"
          @click="outlineOpen = !outlineOpen"
        >
          <ListTree :size="17" />
        </button>
        <button
          class="native-tool"
          :aria-label="t('Görev listesi')"
          :title="t('Görev listesi')"
          :aria-pressed="state.taskList"
          @pointerdown="keepSelection"
          @click="command('taskList')"
        >
          <ListChecks :size="17" />
        </button>
        <button
          class="native-tool"
          :aria-label="t('Biçimlendirmeyi temizle')"
          :title="t('Biçimlendirmeyi temizle')"
          @pointerdown="keepSelection"
          @click="command('clearFormat')"
        >
          <RemoveFormatting :size="17" />
        </button>
        <button
          class="native-tool"
          :aria-label="t('Bul ve değiştir')"
          :title="t('Bul ve değiştir · Ctrl / ⌘ + F')"
          :aria-pressed="searchOpen"
          @pointerdown="keepSelection"
          @click="searchOpen = !searchOpen"
        >
          <Search :size="17" />
        </button>
        <button
          class="native-tool"
          :aria-label="fullscreen ? t('Tam ekrandan çık') : t('Tam ekran')"
          :title="fullscreen ? t('Tam ekrandan çık · Esc') : t('Tam ekran')"
          :aria-pressed="fullscreen"
          @pointerdown="keepSelection"
          @click="fullscreen = !fullscreen"
        >
          <Minimize2 v-if="fullscreen" :size="17" /><Maximize2 v-else :size="17" />
        </button>
      </div>
      <div v-if="tools('review')" class="content-tool-strip" :aria-label="t('İçerik araçları')">
        <button
          :aria-pressed="reviewTab === 'suggestions'"
          @pointerdown="keepSelection"
          @click="openReview('suggestions')"
        >
          {{ t('Öneriler') }}
        </button>
        <button @pointerdown="keepSelection" @click="openDialog('templates')">
          <LayoutTemplate :size="15" /> {{ t('Şablonlar') }}
        </button>
        <button
          :aria-pressed="reviewTab === 'comments'"
          @pointerdown="keepSelection"
          @click="openReview('comments')"
        >
          <MessageSquare :size="15" /> {{ t('Yorumlar') }}
          <b v-if="commentCount">{{ commentCount }}</b>
        </button>
        <button
          :aria-pressed="reviewTab === 'changes'"
          @pointerdown="keepSelection"
          @click="openReview('changes')"
        >
          <GitCompareArrows :size="15" /> {{ t('Değişiklikler') }}
          <b v-if="state.trackedChangeCount">{{ state.trackedChangeCount }}</b>
        </button>
        <button
          :aria-pressed="reviewTab === 'check'"
          @pointerdown="keepSelection"
          @click="openReview('check')"
        >
          <ScanEye :size="16" /> {{ t('İçerik denetimi') }}
        </button>
        <button
          v-if="format"
          class="format-paste-button"
          @pointerdown="keepSelection"
          @click="pasteFormat"
        >
          <Paintbrush :size="14" /> {{ t('Biçimi uygula') }}
        </button>
      </div>
    </div>
  </div>
  <button
    v-if="firstRow || secondRow"
    class="toolbar-overflow-toggle"
    :aria-expanded="toolbarExpanded"
    :aria-label="toolbarExpanded ? t('Araçları daralt') : t('Tüm araçları göster')"
    :title="toolbarExpanded ? t('Araçları daralt') : t('Tüm araçları göster')"
    @pointerdown="keepSelection"
    @click="toolbarExpanded = !toolbarExpanded"
  >
    <X v-if="toolbarExpanded" :size="19" /><Ellipsis v-else :size="20" />
  </button>
</template>
