<script setup>
import { Check, ListOrdered, Palette, RemoveFormatting } from '@lucide/vue'
import EditorPopover from '../EditorPopover.vue'
import EditorMenu from '../EditorMenu.vue'
import TablePicker from '../TablePicker.vue'
import ColorPalette from '../ColorPalette.vue'
import { contentStyles } from '../../editor/writing-widgets.js'
import { listStyles } from '../../lib/menu-options.js'
import { useEditorLocale } from '../../lib/editor-locale'
import { useRichEditor } from './context.js'

const { t, locale: activeLocale } = useEditorLocale()
const {
  menus,
  popup,
  popupAnchor,
  runMenu,
  switchMenu,
  typeOptions,
  applyTypography,
  fontSizeInput,
  applyFontSize,
  onMenuKeys,
  listTag,
  state,
  applyListStyle,
  openListProperties,
  removeCurrentList,
  insertPickedTable,
  customTable,
  foreground,
  background,
  applyColor,
  applyNamedStyle,
} = useRichEditor()
</script>

<template>
  <EditorPopover
    v-if="menus[popup]"
    :key="popup"
    :anchor="popupAnchor"
    :label="t(popup)"
    @close="popup = null"
  >
    <EditorMenu :items="menus[popup]" :label="popup" @select="runMenu" @navigate="switchMenu" />
  </EditorPopover>
  <EditorPopover
    v-if="['fonts', 'sizes', 'blocks'].includes(popup)"
    :key="popup"
    :anchor="popupAnchor"
    :label="
      popup === 'fonts'
        ? t('Yazı tipi menüsü')
        : popup === 'sizes'
          ? t('Yazı boyutu menüsü')
          : t('Paragraf biçimi menüsü')
    "
    @close="popup = null"
  >
    <form v-if="popup === 'sizes'" class="font-size-form" @submit.prevent="applyFontSize">
      <input
        v-model="fontSizeInput"
        type="number"
        min="8"
        max="200"
        step="0.5"
        required
        :aria-label="t('Özel yazı boyutu')"
      /><span>px</span
      ><button type="submit" :aria-label="t('Yazı boyutunu uygula')"><Check :size="16" /></button>
    </form>
    <div class="typography-menu" :class="`typography-${popup}`" role="menu" @keydown="onMenuKeys">
      <button
        v-for="item in typeOptions"
        :key="item.value"
        role="menuitemradio"
        :aria-checked="item.selected"
        :style="item.style"
        @click="applyTypography(item)"
      >
        <Check :size="15" :style="{ visibility: item.selected ? 'visible' : 'hidden' }" /><span>{{
          t(item.label)
        }}</span>
      </button>
    </div>
  </EditorPopover>
  <EditorPopover
    v-if="['bulletStyles', 'numberStyles'].includes(popup)"
    :key="popup"
    :anchor="popupAnchor"
    :label="t(listTag === 'ul' ? 'Madde işareti stilleri' : 'Numaralandırma stilleri')"
    @close="popup = null"
  >
    <div class="list-style-menu" role="menu" @keydown="onMenuKeys">
      <div class="editor-menu-section">
        {{ t(listTag === 'ul' ? 'Madde işareti stilleri' : 'Numaralandırma stilleri') }}
      </div>
      <div class="list-style-grid">
        <button
          v-for="item in listStyles[listTag]"
          :key="item.value"
          role="menuitemradio"
          :aria-label="t(item.label)"
          :aria-checked="
            state.list === listTag && state.listStyle === item.value && !state.taskList
          "
          @click="applyListStyle(listTag, item.value)"
        >
          <span class="list-style-preview" aria-hidden="true"
            ><span v-for="(marker, index) in item.markers" :key="index"
              ><b>{{ marker }}</b
              ><i></i></span
          ></span>
          <span>{{ t(item.label) }}</span>
        </button>
      </div>
      <div class="editor-menu list-style-actions">
        <button
          v-if="listTag === 'ol'"
          role="menuitem"
          :disabled="state.list !== 'ol'"
          @click="openListProperties"
        >
          <ListOrdered :size="16" />{{ t('Liste özellikleri') }}
        </button>
        <button role="menuitem" :disabled="state.list !== listTag" @click="removeCurrentList">
          <RemoveFormatting :size="16" />{{ t('Listeyi kaldır') }}
        </button>
      </div>
    </div>
  </EditorPopover>
  <TablePicker
    v-if="popup === 'table'"
    :anchor="popupAnchor"
    @close="popup = null"
    @insert="insertPickedTable"
    @custom="customTable"
  />
  <ColorPalette
    v-if="['foreground', 'highlight'].includes(popup)"
    :key="popup"
    :anchor="popupAnchor"
    :label="popup === 'highlight' ? t('Vurgu rengi') : t('Metin rengi')"
    :value="popup === 'highlight' ? background : foreground"
    :highlight="popup === 'highlight'"
    @select="applyColor"
    @close="popup = null"
  />
  <EditorPopover
    v-if="popup === 'contentStyles'"
    :anchor="popupAnchor"
    :label="t('İçerik stilleri')"
    @close="popup = null"
  >
    <div class="editor-menu" role="menu" :aria-label="t('İçerik stilleri')" @keydown="onMenuKeys">
      <button
        v-for="style in contentStyles"
        :key="style.id"
        role="menuitemradio"
        :aria-checked="state.contentStyle === style.id"
        @click="applyNamedStyle(style.id)"
      >
        <Palette :size="16" /><span>{{ activeLocale === 'en' ? style.en : style.label }}</span>
      </button>
    </div>
  </EditorPopover>
</template>
