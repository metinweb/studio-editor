import { computed } from 'vue'
import {
  Undo2,
  Redo2,
  Superscript,
  Subscript,
  AlignLeft,
  List,
  ListOrdered,
  Link,
  Image,
  Table2,
  Code2,
  Quote,
  Minus,
  Search,
  Maximize2,
  RemoveFormatting,
  Rows3,
  Columns3,
  Trash2,
  Save,
  FileText,
  MessageSquare,
  LayoutTemplate,
  ScanEye,
  Sparkles,
  Globe,
  Paintbrush,
  ListTree,
  CaseUpper,
  CaseLower,
  ArrowDownAZ,
  ArrowUpAZ,
  Merge,
  Split,
  Film,
  FlaskConical,
  ListChecks,
  Palette,
  ALargeSmall,
  ArrowDownUp,
  Clock,
  Smile,
  Pilcrow,
  CircleHelp,
  FileUp,
  Bookmark,
  Braces,
  Eye,
  WholeWord,
  SquareDashed,
  TextCursorInput,
  Lock,
  LockOpen,
  ShieldCheck,
  Workflow,
  FileStack,
  GitCompareArrows,
  CheckCheck,
  Undo,
} from '@lucide/vue'
import { listStyles, lineHeights } from '../../lib/menu-options.js'
import { includesOption, menuNames } from '../../lib/editor-options'
import { menuFeature } from '../../lib/feature-policy.js'
import {
  alignButtons,
  blocks,
  lockedMenuLabels,
  markButtons,
  menuSections,
  restrictedMenuLabels,
  trackMenuLabels,
} from './options.js'

/** Menubar definitions. Labels are Turkish source messages translated at render time. */
export function createEditorMenus(ctx) {
  const { props, state, emit, t, activeLocale } = ctx
  const toggle = (flag) => () => {
    flag.value = !flag.value
  }
  const allMenus = computed(() => ({
    Dosya: [
      {
        label: 'Markdown içe aktar',
        icon: FileUp,
        action: () => ctx.openDialog('markdownImport'),
      },
      {
        label: 'Markdown dışa aktar',
        icon: FileText,
        action: () => {
          ctx.popup.value = null
          ctx.dialog.value = 'markdownExport'
        },
      },
      { label: 'Word dosyası içe aktar', icon: FileUp, action: () => ctx.openDialog('importWord') },
      { label: 'Belge önizlemesi', icon: Eye, action: ctx.openPreview },
      {
        label: 'Sayfa düzeni ve dışa aktarım',
        icon: FileText,
        action: () => (ctx.dialog.value = 'print'),
      },
      { label: 'Belgeyi kaydet', icon: Save, shortcut: 'Ctrl S', action: () => emit('save') },
      { label: 'HTML kaynak kodu', icon: Code2, action: () => emit('source') },
    ],
    Düzenle: [
      ...[
        ['keep', 'Yapıştır: biçimi koru'],
        ['clean', 'Yapıştır: biçimi temizle'],
        ['text', 'Yapıştır: yalnızca metin'],
      ].map(([mode, label]) => ({
        label,
        active: ctx.pasteMode.value === mode,
        action: () => {
          ctx.setPasteMode(mode)
          emit('update:pasteMode', mode)
        },
      })),
      {
        label: 'Geri al',
        icon: Undo2,
        shortcut: 'Ctrl Z',
        disabled: !state.value.canUndo,
        action: () => ctx.command('undo'),
      },
      {
        label: 'Yinele',
        icon: Redo2,
        shortcut: 'Ctrl Shift Z',
        disabled: !state.value.canRedo,
        action: () => ctx.command('redo'),
      },
      {
        label: 'Bul ve değiştir',
        icon: Search,
        shortcut: 'Ctrl F',
        action: () => {
          ctx.searchOpen.value = true
        },
      },
      { label: 'Tümünü seç', shortcut: 'Ctrl A', action: ctx.selectAll },
      {
        label: 'Düzenlenebilir alan yap',
        icon: LockOpen,
        section: 'Kısıtlı düzenleme',
        action: () => ctx.openDialog('editableRegion'),
      },
      {
        label: 'Düzenlenebilir alanı kaldır',
        icon: Lock,
        disabled: !state.value.editableRegion,
        action: () => ctx.command('unmarkEditable'),
      },
      ...(props.restricted
        ? []
        : [
            {
              label: 'Kısıtlı düzenleme modu',
              icon: ShieldCheck,
              active: ctx.restrictedMode.value,
              action: ctx.toggleRestricted,
            },
          ]),
      {
        label: 'Sonraki düzenlenebilir alan',
        shortcut: 'Tab',
        disabled: !ctx.restrictedMode.value,
        action: () => ctx.focusEditableRegion(false),
      },
      {
        label: 'Önceki düzenlenebilir alan',
        shortcut: 'Shift Tab',
        disabled: !ctx.restrictedMode.value,
        action: () => ctx.focusEditableRegion(true),
      },
    ],
    Görünüm: [
      ...(props.allowContentCss
        ? [
            {
              label: 'İçerik stili ayarları',
              icon: Palette,
              action: () => {
                ctx.dialog.value = 'content-styles'
              },
            },
          ]
        : []),
      { label: 'Belge önizlemesi', icon: Eye, action: ctx.openPreview },
      {
        label: 'Sayfa görünümü',
        icon: FileStack,
        active: ctx.pageView.value,
        action: toggle(ctx.pageView),
      },
      {
        label: 'Blok sınırlarını göster',
        icon: SquareDashed,
        active: ctx.visualBlocks.value,
        action: toggle(ctx.visualBlocks),
      },
      {
        label: 'Görünmeyen karakterleri göster',
        icon: Pilcrow,
        active: ctx.invisibleCharacters.value,
        action: toggle(ctx.invisibleCharacters),
      },
      {
        label: 'Seçili metin araçları',
        icon: TextCursorInput,
        active: ctx.quickToolbar.value,
        action: toggle(ctx.quickToolbar),
      },
      {
        label: 'Yakınlaştırma',
        icon: Search,
        children: [75, 100, 125, 150, 200].map((value) => ({
          label: `${value}%`,
          active: ctx.editorZoom.value === value,
          action: () => {
            ctx.editorZoom.value = value
          },
        })),
      },
      {
        label: 'Belge başlıkları',
        icon: ListTree,
        action: toggle(ctx.outlineOpen),
      },
      {
        label: ctx.fullscreen.value ? 'Tam ekrandan çık' : 'Tam ekran',
        icon: Maximize2,
        action: toggle(ctx.fullscreen),
      },
      { label: 'HTML kaynak kodu', icon: Code2, action: () => emit('source') },
    ],
    Ekle: [
      {
        label: 'Bağlantı hedefleri',
        icon: Bookmark,
        section: 'Belge öğeleri',
        action: () => ctx.openDialog('anchor'),
      },
      { label: 'Dipnotlar', icon: Superscript, action: () => ctx.openDialog('footnote') },
      { label: 'Şablon değişkenleri', icon: Braces, action: () => ctx.openDialog('fields') },
      {
        label: 'Koşullu alan',
        icon: Braces,
        action: () => {
          ctx.conditionalTarget.value = null
          ctx.openDialog('condition')
        },
      },
      {
        label: 'Şablon kütüphanesi',
        icon: LayoutTemplate,
        action: () => ctx.openDialog('templates'),
      },
      { label: 'Yorum ekle', icon: MessageSquare, action: () => ctx.openReview('comments') },
      { label: 'İçindekiler ekle / güncelle', icon: ListTree, action: ctx.insertContents },
      { label: 'Görsel veya medya', icon: Image, action: ctx.openMedia },
      { label: 'Bağlantıdan medya ekle', icon: Film, action: () => ctx.openEmbed() },
      { label: 'Web sayfası göm', icon: Globe, action: () => ctx.openPageEmbed() },
      { label: 'Form oluşturucu', icon: ListChecks, action: () => ctx.openUiElement('form') },
      { label: 'Slider oluşturucu', icon: Rows3, action: () => ctx.openUiElement('slider') },
      {
        label: 'Akordeon oluşturucu',
        icon: ListTree,
        action: () => ctx.openUiElement('accordion'),
      },
      { label: 'Matematik ve kimya', icon: FlaskConical, action: () => ctx.openScience() },
      { label: 'Diyagram (Mermaid)', icon: Workflow, action: () => ctx.openDiagram() },
      { label: 'Görev listesi', icon: ListChecks, action: () => ctx.command('taskList') },
      { label: 'Bağlantı ekle', icon: Link, action: () => ctx.openDialog('link') },
      {
        label: 'Tablo ekle',
        icon: Table2,
        action: () => {
          ctx.popup.value = 'table'
        },
      },
      { label: 'Kod bloğu ekle', icon: Code2, action: () => ctx.openDialog('code') },
      { label: 'Yatay çizgi', icon: Minus, action: () => ctx.insert('<hr><p><br></p>') },
      {
        label: 'Özel karakterler ve emoji',
        icon: Smile,
        section: 'Belge öğeleri',
        action: () => ctx.openDialog('symbols'),
      },
      {
        label: 'Tarih ve saat',
        icon: Clock,
        children: [
          { label: 'Tarih', action: () => ctx.insertDate('date') },
          { label: 'Saat', action: () => ctx.insertDate('time') },
          { label: 'ISO tarihi', action: () => ctx.insertDate('iso') },
        ],
      },
      { label: 'Bölünemez boşluk', action: () => ctx.insert('&nbsp;') },
      {
        label: 'Sayfa sonu',
        icon: FileText,
        action: () =>
          ctx.insert(
            '<hr data-studio-page-break="true" style="break-after:page;page-break-after:always"><p><br></p>',
          ),
      },
    ],
    Biçim: [
      {
        label: 'Paragraf biçimleri',
        icon: Pilcrow,
        section: 'Paragraf ve listeler',
        children: blocks.map((item) => ({
          label: item.label,
          active: state.value.block === item.value,
          action: () => ctx.command('block', item.value),
        })),
      },
      {
        label: 'Hizalama',
        icon: AlignLeft,
        children: alignButtons.map((item) => ({
          label: item.title,
          icon: item.icon,
          active: state.value.align === item.value,
          action: () => ctx.command('align', item.value),
        })),
      },
      ...['ul', 'ol'].map((tag) => ({
        label: tag === 'ul' ? 'Madde işareti stilleri' : 'Numaralandırma stilleri',
        icon: tag === 'ul' ? List : ListOrdered,
        children: listStyles[tag].map((item) => ({
          label: item.label,
          active: state.value.list === tag && state.value.listStyle === item.value,
          action: () => ctx.applyListStyle(tag, item.value),
        })),
      })),
      {
        label: 'Liste özellikleri',
        icon: ListOrdered,
        disabled: state.value.list !== 'ol',
        action: ctx.openListProperties,
      },
      {
        label: 'Satır aralığı',
        icon: ArrowDownUp,
        children: lineHeights.map((value) => ({
          label: value || 'Varsayılan aralık',
          active: state.value.lineHeight === value,
          action: () => ctx.command('blockStyle', 'lineHeight', value),
        })),
      },
      {
        label: 'Metin yönü',
        icon: ALargeSmall,
        children: [
          {
            label: 'Soldan sağa',
            active: state.value.direction === 'ltr',
            action: () => ctx.command('blockStyle', 'direction', 'ltr'),
          },
          {
            label: 'Sağdan sola',
            active: state.value.direction === 'rtl',
            action: () => ctx.command('blockStyle', 'direction', 'rtl'),
          },
        ],
      },
      { label: 'Biçimi kopyala', icon: Paintbrush, action: ctx.copyFormat },
      {
        label: 'Kalıcı kalem',
        icon: Paintbrush,
        active: ctx.permanentPen.value.enabled,
        action: () => ctx.openDialog('pen'),
      },
      {
        label: 'Kopyalanan biçimi uygula',
        icon: Paintbrush,
        disabled: !ctx.format.value,
        action: ctx.pasteFormat,
      },
      {
        label: 'BÜYÜK HARFE ÇEVİR',
        icon: CaseUpper,
        disabled: !state.value.selectedText,
        action: () => ctx.command('changeCase', 'upper'),
      },
      {
        label: 'küçük harfe çevir',
        icon: CaseLower,
        disabled: !state.value.selectedText,
        action: () => ctx.command('changeCase', 'lower'),
      },
      {
        label: 'Başlık biçiminde harfler',
        icon: ALargeSmall,
        disabled: !state.value.selectedText,
        action: () => ctx.command('changeCase', 'title'),
      },
      {
        label: 'Cümle biçiminde harfler',
        icon: ALargeSmall,
        disabled: !state.value.selectedText,
        action: () => ctx.command('changeCase', 'sentence'),
      },
      ...markButtons.map((tool) => ({
        label: tool.title,
        icon: tool.icon,
        active: !!state.value[tool.command],
        shortcut: { bold: 'Ctrl B', italic: 'Ctrl I', underline: 'Ctrl U' }[tool.command],
        action: () => ctx.command('inline', tool.command),
      })),
      { label: 'Alıntı', icon: Quote, action: () => ctx.command('block', 'blockquote') },
      { label: 'Alt simge', icon: Subscript, action: () => ctx.command('inline', 'subscript') },
      {
        label: 'Üst simge',
        icon: Superscript,
        action: () => ctx.command('inline', 'superscript'),
      },
      {
        label: 'Biçimlendirmeyi temizle',
        icon: RemoveFormatting,
        action: () => ctx.command('clearFormat'),
      },
    ],
    Tablo: [
      {
        label: 'Tablo formülü',
        icon: Table2,
        disabled: !state.value.table,
        action: () => ctx.openDialog('formula'),
      },
      ...[
        ['target', 'Tablo yapıştır: hedef biçimini koru'],
        ['source', 'Tablo yapıştır: kaynak hücre biçimini kullan'],
      ].map(([value, label]) => ({
        label,
        active: ctx.tablePasteStyle.value === value,
        action: () => {
          ctx.setTablePasteStyle(value)
          emit('update:tablePasteStyle', value)
        },
      })),
      {
        label: 'Hücre biçimi',
        icon: Paintbrush,
        disabled: !state.value.canEditTable,
        action: ctx.openCellFormat,
      },
      {
        label: 'Seçili hücreleri birleştir',
        icon: Merge,
        disabled: !state.value.canMergeCells,
        action: () => ctx.command('mergeCells'),
      },
      {
        label: 'Alttaki hücreyle birleştir',
        icon: Merge,
        disabled: !state.value.canMergeDown,
        action: () => ctx.command('mergeCellDown'),
      },
      {
        label: 'Seçili sütuna göre A → Z',
        icon: ArrowDownAZ,
        disabled: !state.value.table || state.value.complexTable,
        action: () => ctx.command('tableSort', 1),
      },
      {
        label: 'Seçili sütuna göre Z → A',
        icon: ArrowUpAZ,
        disabled: !state.value.table || state.value.complexTable,
        action: () => ctx.command('tableSort', -1),
      },
      {
        label: 'Sağdaki hücreyle birleştir',
        icon: Merge,
        disabled: !state.value.canMergeRight,
        action: () => ctx.command('mergeCellRight'),
      },
      {
        label: 'Hücreyi ayır',
        icon: Split,
        disabled: !state.value.canSplitCell,
        action: () => ctx.command('splitCell'),
      },
      {
        label: 'Tablo ekle',
        icon: Table2,
        action: () => {
          ctx.popup.value = 'table'
        },
      },
      {
        label: 'Satır ekle',
        icon: Rows3,
        disabled: !state.value.canEditTable,
        action: () => ctx.command('table', 'addRow'),
      },
      {
        label: 'Sütun ekle',
        icon: Columns3,
        disabled: !state.value.canEditTable,
        action: () => ctx.command('table', 'addColumn'),
      },
      {
        label: 'Tabloyu sil',
        icon: Trash2,
        disabled: !state.value.table,
        action: () => ctx.command('table', 'deleteTable'),
      },
    ],
    Araçlar: [
      ...(props.documentSession
        ? [
            {
              label: 'CMS sürüm geçmişi',
              icon: Clock,
              action: () => ctx.openDialog('cmsHistory'),
            },
          ]
        : []),
      ...(props.trackChanges
        ? []
        : [
            {
              label: 'Değişiklikleri izle',
              icon: GitCompareArrows,
              section: 'İnceleme',
              active: ctx.trackMode.value,
              action: () => ctx.toggleTrackChanges(),
            },
          ]),
      {
        label: 'İzlenen değişiklikler',
        icon: GitCompareArrows,
        section: 'İnceleme',
        action: () => ctx.openReview('changes'),
      },
      {
        label: 'Tüm değişiklikleri kabul et',
        icon: CheckCheck,
        disabled: !state.value.trackedChangeCount,
        action: () => ctx.resolveAllChanges(true),
      },
      {
        label: 'Tüm değişiklikleri reddet',
        icon: Undo,
        disabled: !state.value.trackedChangeCount,
        action: () => ctx.resolveAllChanges(false),
      },
      { label: 'AI yazım yardımcısı', icon: Sparkles, action: () => ctx.openDialog('ai') },
      { label: 'Yazım ve dil bilgisi', icon: ScanEye, action: () => ctx.openDialog('language') },
      {
        label: 'Otomatik düzeltme ve metin kısayolları',
        icon: TextCursorInput,
        active: ctx.writingPreferences.value.enabled,
        action: () => ctx.openDialog('writingSettings'),
      },
      { label: 'Sözcük sayımı', icon: WholeWord, action: ctx.openMetrics },
      {
        label: 'Tipografiyi iyileştir',
        icon: ALargeSmall,
        action: () => ctx.command('typography'),
      },
      { label: 'Belge yorumları', icon: MessageSquare, action: () => ctx.openReview('comments') },
      { label: 'Erişilebilirlik denetimi', icon: ScanEye, action: () => ctx.openReview('check') },
      {
        label: 'Şablon kütüphanesi',
        icon: LayoutTemplate,
        action: () => ctx.openDialog('templates'),
      },
      { label: 'İçindekiler ekle / güncelle', icon: ListTree, action: ctx.insertContents },
      { label: 'Komut bul', icon: Search, action: ctx.openCommandSearch },
    ],
    Yardım: [
      { label: 'Komut bul', icon: Search, action: ctx.openCommandSearch },
      {
        label: 'Klavye kısayolları',
        icon: CircleHelp,
        action: () => {
          ctx.dialog.value = 'help'
        },
      },
    ],
  }))
  const menus = computed(() =>
    Object.fromEntries(
      Object.entries(menuNames)
        .filter(([id]) => includesOption(props.menubar, id))
        .map(([, name]) => [
          name,
          allMenus.value[name]
            .filter((item) => ctx.allowed(menuFeature(item.label)))
            .filter((item) => !ctx.locked.value || lockedMenuLabels.includes(item.label))
            .filter(
              (item) => !ctx.restrictedMode.value || restrictedMenuLabels.includes(item.label),
            )
            .filter((item) => !ctx.trackMode.value || trackMenuLabels.includes(item.label))
            .map((item) => ({ ...item, section: item.section || menuSections[item.label] })),
        ])
        .filter(([, items]) => items.length),
    ),
  )
  const foundCommands = computed(() => {
    const found = []
    const seen = new Set()
    const visit = (items, section) =>
      items.forEach((item) => {
        if (item.children) visit(item.children, `${section} / ${t(item.label)}`)
        else if (item.label !== 'Komut bul' && !seen.has(item.label)) {
          seen.add(item.label)
          found.push({ ...item, trail: section })
        }
      })
    Object.entries(menus.value).forEach(([name, items]) => visit(items, t(name)))
    const query = ctx.commandQuery.value.trim().toLocaleLowerCase(activeLocale.value)
    return found.filter((item) =>
      `${t(item.label)} ${item.trail}`.toLocaleLowerCase(activeLocale.value).includes(query),
    )
  })
  return { menus, foundCommands }
}
