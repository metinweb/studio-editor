# Studio Editor — Vue 3

[English](README.md) · Türkçe

Varsayılan arayüz İngilizcedir. Türkçe için `locale="tr"` kullanın.

## Yapıştırma seçenekleri (beta.4)

`pasteMode`: `keep` (varsayılan), `clean` veya `text`; dinamik değiştirilebilir.
Menü seçimlerini izlemek için `v-model:paste-mode="mode"` kullanın.
`@paste`, `{ source, mode, rows, columns, warnings, inserted }` döndürür;
HTML taşımaz. `PasteMode` ve `PasteInfo` TypeScript tipleri sunulur.

Word sayısal/maddeli listeleri, iç içe seviyeler, Excel/Sheets dikdörtgen TSV
(tırnaklı hücreler dahil), HTML tabloları ve Google Docs başlıkları işlenir.
`clean` satır içi biçimi kaldırır, yapıyı korur; `text` HTML ve görseli almaz.
Ctrl/⌘+Shift+V ve kod bloğuna yapıştırma düz metindir. Metin+görsel tek undo
adımında eklenir. Yüklemede belge değişirse eski konuma eklenmez.

Tam Office/RTF/özel liste şablonu desteği değildir.
HTML+metin 5 Mi UTF-16 kod birimi, tablo 10.000 hücre;
TSV ayrıca 1.000 satır/100 sütunla sınırlıdır. Yerel görsel eşleştirme
tarayıcının dosya sırasına/sayısına bağlıdır. Uyarılar bu betada Türkçedir.

## Tablo işlemleri (beta.9)

`tablePasteStyle`: `target` (varsayılan) veya `source`. Dinamik prop ve
`v-model:table-paste-style` desteklenir; Tablo menüsü değişimleri
`update:tablePasteStyle` olayı üretir. `TablePasteStyle` tipi dışa aktarılır.
`source`, yalnız `keep` + HTML tablo yapıştırmada kaynak hücrenin açık renk,
tipografi, hizalama, padding ve kenar stillerini hedefe uygular. Desteklenen
hedef stilleri önce kaldırılır; kaynaktaki eksikler varsayılana döner.
Hedef genişlikleri, kimlikleri ve th/td/scope yapısı korunur. Kaynak CSS sınıfı,
miras alınan stiller, ölçüler, URL/değişken/konumlandırma ve !important taşınmaz.
`clean`, `text` ve TSV hedef biçimini korur. Tercih örnekler arasında paylaşılmaz.

Beta.8 HTML matrisinin rowspan/colspan yapısını hedef alana taşır. Normal
tablo/TSV, tamamen kapsanan birleşik hedefi normal hücrelere ayırır. Kısmen
kapsanan birleşimler, bölüm sınırını aşan rowspan, taşma ve boyut uyuşmazlığı
belgeyi değiştirmeden reddedilir. Tek 1×1 değer hedef birleşimleri korur.
Hedef hücre türü/stili temel alınır; kaynak içeriğin biçimi pasteMode'a uyar.
Kaynak hücre stilleri yukarıdaki tercihe bağlıdır; tablo genişlikleri alınmaz.
TSV birleşim bilgisi taşımaz.
İşlem tek `pasteCells` olayı/undo adımıdır; `paste.rows/columns` mantıksal
boyutları bildirir. Bunlar temsilî Office pano testleriyle doğrulanmıştır.

Hücre biçimi penceresi, tek/çoklu seçime dolgu, metin rengi, yatay/dikey
hizalama, iç boşluk ve tüm/dış/iç kenarlık uygular. Yalnızca değiştirilen
alanlar güncellenir; sıfırlama içeriği ve tablo yapısını korur. İşlem türü
`formatCells`, tek undo adımıdır. Belge değişmişse eski taslak reddedilir.
Pencere Türkçe/İngilizcedir. Satır içindeki özel metin renkleri/hizalama
korunur; komşu hücre kenarlıkları CSS çakışma kurallarına tabidir.

Shift+tık, sürükleme veya Alt+Shift+ok ile dikdörtgen hücre seçilir;
Esc seçimi kapatır. Birleşik hücreler tam kapsanır. Kopyala/kes HTML tablo ve
TSV üretir; Delete/Backspace seçili içerikleri temizler. Seçim katmanı HTML
dışındadır. Yapıştırma mevcut hücrelere dağıtılır; seçili alan boyutuyla
uyuşmazsa, sığmazsa veya hedef birleşimin yalnızca bir bölümünü kapsarsa
uyarı verir ve belge değişmez. Tek değer seçime tekrarlanabilir. İşlemler tek
undo adımıdır; `transaction.kind` değeri `pasteCells` veya `clearCells` olur.

İç sütun sınırını sürüklemek komşu sütunları dengeler; ok tuşları 1 px,
Shift+ok 10 px. Esc ve readonly iptal eder. Genişlikler colgroup ile HTML'de
korunur. RTL sütun geometri desteği ve dokunmatik doğrulama henüz tamamlanmadı.

Beta.6 ile seçili dikdörtgeni, sağdaki veya alttaki hücreyi birleştirme;
yatay/dikey birleşimi ayırma; birleşik tablolara satır/sütun ekleme-silme
eklendi. Hücre başka satır/sütunlarda yaşamaya devam ediyorsa silmede içeriği
korunur; tamamen silinen hücrelerin içeriği kaldırılır. Birleştirme sol üst
hücrenin stilini kullanır; ayırmada içerik sol üstte kalır, diğer hücreler boş
oluşur. Önceki dağılım undo ile geri gelir. Farklı tablo bölümleri birleşmez.
`transaction.kind`: `mergeCells`, `splitCell`, `addRow`, `addRowBefore`,
`appendRow`, `deleteRow`, `addColumn`, `addColumnBefore`, `deleteColumn`.

Bağımsız düzenleme motoru, tablo araçları, yerleşik resim editörü, medya kütüphanesi,
yorumlar ve renklendirilmiş HTML kaynak görünümü içeren **yerel beta paketi**.

Proje MIT lisansıyla açık kaynak olarak yayımlanmıştır.
Bu paket henüz npm kayıt deposunda yayımlanmadı; aşağıdaki kurulum yerel `.tgz` içindir.

## Kurulum

```sh
npm install ./studio-editor-0.1.0-beta.11.tgz vue@^3.5 pinia@^4
```

Uygulama girişinde Pinia kurun (zaten varsa ikinci kez kurmayın):

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

createApp(App).use(createPinia()).mount('#app')
```

```vue
<script setup>
import { ref } from 'vue'
import { StudioEditor } from 'studio-editor'
import 'studio-editor/style.css'

const content = ref('<p>Merhaba!</p>')
const editor = ref(null)
function save(html) {
  // Kendi kayıt API'nize gönderin. Sunucuda da HTML doğrulaması yapın.
  console.log(html)
}
</script>

<template>
  <StudioEditor ref="editor" v-model="content" :height="600" @save="save" />
</template>
```

## API

Beta.3 entegrasyon seçenekleri çalışma sırasında güncellenebilir; belge veya
undo geçmişini sıfırlamaz. Medya adaptörünü değiştirmek hâlâ yeni `key` gerektirir.

```vue
<StudioEditor
  v-model="content"
  :readonly="false"
  :disabled="false"
  placeholder="İçeriğinizi yazın…"
  :toolbar="['history', 'typography', 'format', 'insert']"
  :menubar="['file', 'edit', 'insert']"
  locale="en"
  :messages="{ Kalın: 'Strong' }"
/>
```

| Seçenek       | Davranış                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `readonly`    | Varsayılan `false`. Kullanıcı düzenlemesi, undo/redo, yapıştırma/drop ve mutasyon araçları kapanır. Seçim/kopyalama, bulma, tam ekran ve salt okunur kaynak görünümü kullanılabilir. |
| `disabled`    | Varsayılan `false`. Salt okunur sınırlamalarına ek olarak editör odağı ve etkileşimi `inert` ile kapanır.                                                                            |
| `placeholder` | Boş metin belgesinde görünen düz metin ipucu. HTML çıktısına, geçmişe ve belge metnine eklenmez. Medya/tablo/liste/kod içeren belge boş sayılmaz.                                    |
| `toolbar`     | `true`: varsayılan gruplar; `false` veya `[]`: gizli; grup dizisi: seçilen gruplar standart sırada.                                                                                  |
| `menubar`     | `true`: tüm üst menüler; `false` veya `[]`: gizli; menü kimliği dizisi: seçilen menüler standart sırada.                                                                             |
| `locale`      | `en` (varsayılan) veya `tr`. Çekirdek arayüz, temel pencereler, arama ve kaynak görünümü.                                                                                            |
| `messages`    | Türkçe kaynak metnini anahtar alan, editöre özel düz metin çevirileri. Yerleşik sözlüğün önüne geçer; HTML çalıştırılmaz.                                                            |

Araç grupları: `history`, `typography`, `format`, `color`, `align`, `lists`,
`insert`, `tools`, `review`. Üst menüler: `file`, `edit`, `view`, `insert`,
`format`, `table`, `tools`. `toolbarGroups`, `menuNames`, `englishMessages`
dışa aktarılır. Bilinmeyen grup/menü kimlikleri gösterilmez; TypeScript bunları
reddeder. Araç görünürlüğü bir yetkilendirme sistemi değildir; içerik değişimini
engellemek için `readonly`/`disabled` kullanın.

Her iki modda da uygulama `v-model` ve `setHTML` ile yeni içerik yükleyebilir.
Bu değişimler geçmişe kaydedilir; kullanıcı düzenlemesi açıldığında geri
alınabilir. `insertHTML`, `undo`, `redo` kilitli modlarda işlem yapmaz;
`focus` devre dışı modda işlem yapmaz. Mod değişimi açık pencereleri kapatır,
aktif sürüklemeyi iptal eder; önceki modda başlayan dosya eklemesi sonradan
belgeyi değiştiremez. Adaptör yüklemesi iptal sinyali alır.

Dil/mesaj değişimi iframe'i yeniden yüklemez; iframe'in `lang` ve erişilebilir
etiketleri güncellenir. Belge metni ve Türkçe büyük/küçük harf komutunun davranışı
değişmez. Çalışma alanı, gelişmiş paneller ve hazır şablonlar İngilizce/Türkçe sunulur. Kullanıcı içeriği otomatik çevrilmez. Sözlükte bulunmayan tanılama mesajları kaynak dilinde kalabilir. Türkçe kaynak anahtarları beta API’sinin parçasıdır.

| Alan                              | Davranış                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `modelValue` / `v-model`          | Belge HTML'i; varsayılan boş belge.                                                 |
| `height`                          | Piksel sayısı veya `70vh` gibi CSS yüksekliği; varsayılan 600, minimum 320 px.      |
| `update:modelValue`, `change`     | Değişen HTML. Yorum metaverisini içerir.                                            |
| `ready`                           | `StudioEditorApi` nesnesi. Metotları bu olaydan sonra kullanın.                     |
| `save`                            | Ctrl/⌘+S veya kaydet menüsünde güncel HTML. Kayıt işlemini tüketici gerçekleştirir. |
| `getHTML()`                       | Yorum metaverisini de içeren belge HTML'i.                                          |
| `getPublicHTML()`                 | Yorum metaverisi çıkarılmış, temizlenmiş yayın HTML'i.                              |
| `setHTML(html)`                   | İçeriği temizleyerek değiştirir; geri alınabilir.                                   |
| `insertHTML(html)`                | Seçime temizlenmiş HTML ekler.                                                      |
| `focus()`, `undo()`, `redo()`     | Odak ve düzenleme geçmişi.                                                          |
| `openMedia()`, `openSource()`     | Yerleşik medya ve kaynak pencereleri.                                               |
| `getDocument()`                   | Oturuma ait `{ schemaVersion: 1, revision, html, blockIds }`.                       |
| `getHistoryStats()`               | Undo/redo sayıları, `patchBytes` ve `documentBytes`; gerçek heap ölçümü değildir.   |
| `transaction`                     | Yerel değişim/undo/redo için sürümlü HTML farkı, seçim ve blok eşleme bilgisi.      |
| `mediaAdapter`                    | İsteğe bağlı sunucu medya sağlayıcısı; mount sırasında bağlanır.                    |
| `upload-progress`, `upload-error` | Özel medya sağlayıcısının toplu ilerleme yüzdesi (0–100) ve hata metni.             |

`StudioEditorApi`, `StudioEditorProps` TypeScript tipleri yayımlanır.
`cleanHtml`, `publicHtml`, `renderDocument({ title, content })` ve `documentCss`
yardımcıları da dışa aktarılır. HTML yardımcıları tarayıcı DOM'u gerektirir.

`EditorDocument`, `EditorTransaction`, `HistoryStats`, `SelectionBookmark`,
`MediaAdapter` ve `MediaAsset` tipleri de sunulur. `mapSelection` ve `mapOffset`
aynı blok içindeki metin değişimlerinin seçim konumunu eşlemek içindir;
eşzamanlı düzenleme veya tüm yapısal dönüşümler için yeterli değildir.

## Sunucu medya adaptörü

```vue
<StudioEditor
  v-model="content"
  :media-adapter="mediaAdapter"
  @upload-progress="(percent) => console.log(percent)"
  @upload-error="(message) => console.error(message)"
/>
```

`mediaAdapter` dört asenkron metot sunmalıdır: `list()` dosya listesini,
`upload(file, { signal, alt, onProgress })` yüklenen dosyayı,
`update(asset)` güncellenen dosyayı döndürür; `remove(id)` silmeyi tamamlar.
Kayıt biçimi `{ id, name, type, size, url, alt?, createdAt? }` şeklindedir.
İlerleme callback'ine 0–1 arası değer verin; `signal` iptalinde isteği durdurun.
Hataları throw/reject ile iletin. İstemci hatalı kayıtları ve güvensiz URL'leri
reddeder; başarısız dosyalar tekrar denenebilir, geç gelen iptal sonuçları atılır.

Bu paket backend sağlamaz. Kimlik doğrulama, dosya denetimi ve kalıcı URL üretimi
sağlayıcınıza aittir. Belgeye URL yazılır; imzalı URL yenileme yoktur. Uzak
görselleri düzenlemek için CORS izni gerekir. Sağlayıcıyı değiştirmek için yeni
`key` ile mount edin. Sunucudan silinen dosya mevcut belgelerde de kaybolabilir.

## İşlem ve geçmiş sınırları

Geçmiş bir güncel belge ve en fazla 79 tersine çevrilebilir fark kaydı tutar.
Yaklaşık 16 MiB fark bütçesi vardır; en az bir undo korunduğu için büyük bir
işlem bütçeyi aşabilir. Gömülü görseller komşu metin değişimlerinde kopyalanmaz.
`patchBytes` serileştirilmiş UTF-16 boyut hesabıdır, toplam bellek kullanımı değildir.

İşlemler UTF-16 ofsetli `replaceHtml` farklarıdır. Revizyonlar ve HTML dışında
tutulan blok kimlikleri oturum içindir; `getDocument()` henüz geri yüklenebilen
taşınabilir bir belge formatı değildir. Aynı DOM bloğu düzenlenirken kimliği
korunur ve undo/redo ile geri yüklenir; yeni DOM bloğu yeni kimlik alır.
Anlamsal işlem modeli, kalıcı sürüm geçmişi, CRDT ve değişiklik izleme yoktur.

## Entegrasyon sınırları

- ESM paketi; Vue 3.5+ ve Pinia 4 eş bağımlılıktır. CJS/UMD/CDN global sürümü yoktur.
- CSS'i bir kez içe aktarın. Kütüphane stilleri `.studio-editor-scope` ile
  sınırlıdır; `body`, `h1`, `button` gibi ana sayfa öğelerini sıfırlamaz.
  Ana sitenin agresif `!important` kurallarına karşı Shadow DOM yalıtımı sağlamaz.
- Sayfada birden fazla editörün belgesi ve geri alma geçmişi ayrıdır.
  Varsayılan medya ve kişisel şablon kütüphanesi aynı Pinia/origin içinde paylaşılır.
  Özel medya adaptörlerinin durumu editör örneğine özeldir.
  Mağaza kimlikleri `studio-media` ve `studio-templates` olarak adlandırılır.
- **Belge otomatik kaydedilmez.** `v-model` ve `save` olayını kendi kayıt
  sisteminize bağlayın. Medya/şablonlar varsayılan olarak IndexedDB'de tutulur.
  Varsayılan görseller data URL olarak eklenir; `mediaAdapter` sunucu URL'si kullanabilir.
- Eski belgelerle uyumluluk için tarayıcı veritabanı adı `tinymce-studio`
  korunmuştur. Bu bir motor bağımlılığı değildir. IndexedDB origin'e bağlıdır.
- SSR ortamında modül içe aktarılabilir; editörü istemcide mount edin
  (örneğin Nuxt `ClientOnly`). Sunucuda DOM yardımcılarını çağırmayın.
- Varsayılan arayüz İngilizcedir. Çekirdek İngilizce desteği ve editöre özel
  sözlük vardır. Beta.10 resim/medya/şablon/inceleme panellerinin İngilizce
  kapsamını ve `direction="rtl"` desteğini genişletir; bazı dinamik bildirimler
  ve hazır şablon içerikleri Türkçe kalabilir.
- Resim düzenleme: 8192 px kenar / 16 MP; medya dosyası: 12 MB.
  Uzak görsellerin düzenlenmesi CORS iznine bağlıdır.
- Modern Chromium, Firefox ve WebKit motorları hedeflenir. Gerçek iOS/Android
  klavye ve ekran okuyucu doğrulaması henüz tamamlanmadı.

`LICENSE` projenin MIT lisansını; `THIRD_PARTY_NOTICES.txt`
paketlenen bağımlılıkların kendi lisanslarını içerir.

## Beta.10 ekleri

Yeni API: `getModel`, `setModel`, `applyOperations`, `registerPlugin`, `executeCommand`, `getCommands`, `refreshMedia`; paket yardımcıları `createHttpMediaAdapter`, `createDocumentSession`, `renderPrintDocument`, `printDocument`, `exportDocx`, `loadCollaboration`. `direction` prop'u `ltr`, `rtl`, `auto` kabul eder. Slash menüsü, Markdown blok kısayolları, sürüklenebilir bloklar, WebP/kalite, metin önerileri ve DOCX/yazdırma paneli bileşene dahildir. Resim Worker'ı pakete gömülüdür; CSP kullanıyorsanız `worker-src blob:` izni gerekir, desteklenmeyen ortamlarda ana iş parçacığına dönülür.

İş birliği deneysel: canlı binding ve yerel undo vardır; eş zamanlı karmaşık yapı değişiklikleri henüz üretim doğrulamasından geçmemiştir. Yeni `.studio.json` yedekleri ve kalıcı sürüm paneli bağımsız web uygulamasındadır. Proje MIT lisansıyla açık kaynaktır; npm kayıt deposuna yayın yapılmadı.

`blockIds` prop'unu kaydedilmiş belgeyle birlikte sağlayabilirsiniz. `transaction.blockIdsAfter`
değerini HTML ile birlikte saklayın. Şema 2 modeli zaten kimlikleri içerir.
`applyOperations` revizyonu eskiyse değişiklik uygulamadan hata verir.

```js
// ready olayında verilen API ile:
const model = api.getModel()
api.applyOperations({
  baseRevision: model.revision,
  operations: [{ type: 'moveBlock', blockId: model.blocks[0].id, index: 1 }],
})
const dispose = api.registerPlugin({
  id: 'my-tools',
  commands: [
    {
      id: 'signature',
      title: 'İmza',
      execute: (editor) => editor.insertHTML('<p>Saygılarımla</p>'),
    },
  ],
})
api.executeCommand('my-tools/signature')
dispose()
```

Komut API'si güvenilir uygulama kodu içindir; eklenti sandbox'ı değildir.
`createDocumentSession` sağlayıcısının `save(record, {expectedVersion})` uygulaması
beklenen sürümü sunucuda atomik karşılaştırmalıdır. Çakışma yerel taslağı silmez.
Medya sunucusu ve ortak düzenleme HTTP sunucusu örnekleri kaynak deponun
`examples/` klasöründedir; tarball içine sunucu kurulumu eklenmez.
