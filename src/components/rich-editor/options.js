import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from '@lucide/vue'
import { documentCss } from '../../lib/content'

export const markButtons = [
  { command: 'bold', title: 'Kalın', icon: Bold },
  { command: 'italic', title: 'İtalik', icon: Italic },
  { command: 'underline', title: 'Altı çizili', icon: Underline },
  { command: 'strike', title: 'Üstü çizili', icon: Strikethrough },
]
export const alignButtons = [
  { value: 'left', title: 'Sola hizala', icon: AlignLeft },
  { value: 'center', title: 'Ortala', icon: AlignCenter },
  { value: 'right', title: 'Sağa hizala', icon: AlignRight },
  { value: 'justify', title: 'İki yana yasla', icon: AlignJustify },
]
export const fonts = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Arial Black', value: '"Arial Black", sans-serif' },
  { label: 'Comic Sans MS', value: '"Comic Sans MS", cursive' },
  { label: 'Consolas', value: 'Consolas, monospace' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
]
export const fontSizes = [8, 10, 12, 14, 16, 17, 18, 20, 24, 28, 32, 36, 48, 64, 72]
export const blocks = [
  { label: 'Paragraf', value: 'p', size: '14px' },
  { label: 'Başlık 1', value: 'h1', size: '26px' },
  { label: 'Başlık 2', value: 'h2', size: '22px' },
  { label: 'Başlık 3', value: 'h3', size: '18px' },
  { label: 'Başlık 4', value: 'h4', size: '16px' },
  { label: 'Başlık 5', value: 'h5', size: '14px' },
  { label: 'Başlık 6', value: 'h6', size: '12px' },
  { label: 'Alıntı', value: 'blockquote', size: '14px' },
  { label: 'Ön biçimlendirilmiş', value: 'pre', size: '13px' },
]
export const codeLanguages = ['javascript', 'html', 'css', 'json', 'sql', 'php', 'python', 'bash']
export const shortcuts = [
  ['Geri al', 'Ctrl / ⌘ Z'],
  ['Yinele', 'Ctrl / ⌘ Shift Z'],
  ['Kalın', 'Ctrl / ⌘ B'],
  ['İtalik', 'Ctrl / ⌘ I'],
  ['Altı çizili', 'Ctrl / ⌘ U'],
  ['Bul ve değiştir', 'Ctrl / ⌘ F'],
  ['Belgeyi kaydet', 'Ctrl / ⌘ S'],
  ['Tümünü seç', 'Ctrl / ⌘ A'],
  ['Menüde gezinme', '↑ ↓ Home End'],
  ['Alt menüyü aç / geri dön', '→ / ←'],
  ['Menüyü kapat', 'Esc'],
]
/** Menu items that stay available while the editor is readonly or disabled. */
export const lockedMenuLabels = [
  'Belgeyi kaydet',
  'Markdown dışa aktar',
  'HTML kaynak kodu',
  'Bul ve değiştir',
  'Tam ekran',
  'Tam ekrandan çık',
  'Belge başlıkları',
  'Komut bul',
  'Klavye kısayolları',
  'Belge önizlemesi',
  'Sözcük sayımı',
  'Yakınlaştırma',
  'Sayfa görünümü',
  'Blok sınırlarını göster',
  'Görünmeyen karakterleri göster',
]
/** Menu items in restricted mode: navigation, history and inline formatting only. */
export const restrictedMenuLabels = [
  ...lockedMenuLabels.filter((label) => label !== 'HTML kaynak kodu'),
  'Geri al',
  'Yinele',
  'Kısıtlı düzenleme modu',
  'Sonraki düzenlenebilir alan',
  'Önceki düzenlenebilir alan',
  'Kalın',
  'İtalik',
  'Altı çizili',
  'Üstü çizili',
  'Biçimlendirmeyi temizle',
]
/** Menu items while tracking changes: text suggestions, review and navigation. */
export const trackMenuLabels = [
  ...lockedMenuLabels.filter((label) => label !== 'HTML kaynak kodu'),
  'Geri al',
  'Yinele',
  'Tümünü seç',
  'Değişiklikleri izle',
  'İzlenen değişiklikler',
  'Tüm değişiklikleri kabul et',
  'Tüm değişiklikleri reddet',
  'Yorum ekle',
  'Belge yorumları',
  'AI yazım yardımcısı',
  'Yazım ve dil bilgisi',
  'Özel karakterler ve emoji',
  'Tarih ve saat',
  'Erişilebilirlik denetimi',
]
export const menuSections = {
  'Sayfa düzeni ve dışa aktarım': 'Belge işlemleri',
  'Yapıştır: biçimi koru': 'Yapıştırma',
  'Geri al': 'Düzenleme',
  'Belge başlıkları': 'Belgede gezinme',
  'Şablon kütüphanesi': 'Belge öğeleri',
  'Görsel veya medya': 'Medya ve bağlantılar',
  'Biçimi kopyala': 'Metin biçimi',
  'Tablo yapıştır: hedef biçimini koru': 'Yapıştırma',
  'Hücre biçimi': 'Hücre işlemleri',
  'Tablo ekle': 'Tablo yapısı',
  'Belge yorumları': 'İnceleme',
}
// CSP blocks document scripts. WebKit needs allow-scripts for event callbacks
// registered by the parent; the CSP still rejects inline and external scripts.
export const frameDocument = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><style>${documentCss}html{background:#fff;color-scheme:light}body{position:relative;outline:none;min-height:calc(100vh - 160px);overflow-wrap:anywhere}table{width:100%}td,th{min-width:40px}a{cursor:text}img{cursor:default}::selection{background:#b4d7ff}pre{white-space:pre-wrap}body:focus{outline:none}body[data-empty="true"]::before{content:attr(data-placeholder);position:absolute;top:14px;left:32px;right:32px;color:#77808d;pointer-events:none;white-space:pre-wrap}[data-studio-thread]{background:#fff1bf;border-bottom:2px solid #dfb455}[data-studio-resolved="true"]{background:transparent;border-bottom:1px dotted #b8b0c4}[data-studio-editable]{background:rgba(255,196,46,.16);box-shadow:0 0 0 1px rgba(196,140,0,.5);border-radius:3px}span[data-studio-editable]{padding:0 2px}span[data-studio-editable]:empty{display:inline-block;min-width:2em;min-height:1em;vertical-align:text-bottom}div[data-studio-editable]{padding:2px 8px;margin:8px -8px}ins[data-studio-change="insert"]{color:#0b6b35;background:rgba(22,163,74,.13);text-decoration:underline;text-decoration-color:rgba(22,163,74,.7)}del[data-studio-change="delete"]{color:#b42318;background:rgba(220,38,38,.08);text-decoration:line-through}[data-studio-change="split"]{box-shadow:inset 3px 0 0 rgba(22,163,74,.6);padding-left:6px}[data-studio-change="join"]{box-shadow:inset 3px 0 0 rgba(220,38,38,.6);padding-left:6px}body[data-restricted="true"]{caret-color:transparent}body[data-restricted="true"] [data-studio-editable]{background:rgba(255,196,46,.28);caret-color:auto;cursor:text}</style></head><body contenteditable="true" role="textbox" aria-label="Belge içeriği" aria-multiline="true" spellcheck="true"></body></html>`
