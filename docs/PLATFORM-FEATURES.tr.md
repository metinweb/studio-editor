# İnceleme, koruma, sayfa ve platform özellikleri

Ekim 2026 güncellemesi (0.1.0-beta.12). Her bölüm uygulanan davranışı, kullanımı ve sınırları
anlatır. [English](PLATFORM-FEATURES.md)

## Değişiklikleri izleme

**Araçlar → Değişiklikleri izle** (veya inceleme panelindeki **Değişiklikler** sekmesindeki anahtar)
düzenlemeleri doğrudan uygulamak yerine öneri olarak kaydeder:

- Yazılan metin `<ins data-studio-change="insert">` olur; silinen metin kaybolmaz,
  `<del data-studio-change="delete">` içinde üstü çizili görünür. Seçimin üzerine yazmak tek bir
  _değiştirme_ önerisidir; iki parça aynı değişiklik kimliğini taşır.
- Enter paragraf bölme (`data-studio-change="split"`), paragraflar arasında Backspace/Delete
  paragraf birleştirme (`data-studio-change="join"`) önerisi oluşturur.
- Kendi önerdiğiniz metni silmek onu gerçekten kaldırır; kendi yeni paragrafınızın başında
  Backspace önerilen bölmeyi geri alır.
- Düz metin yapıştırma, kesme, bul-değiştir ve AI/dil bilgisi değiştirmeleri de izlenir. IME
  kompozisyonu bittiğinde ekleme önerisine dönüştürülür (otomatik testler Chromium'u kapsar;
  hedef mobil klavyelerinizde ayrıca deneyin).
- Her değişiklik kimlik, yazar kimliği/adı ve ISO zaman bilgisi taşır. İnceleme paneli
  değişiklikleri **Belgede göster**, **Kabul et**, **Reddet**, **Tümünü kabul et** ve
  **Tümünü reddet** ile listeler. Her çözümleme tek geri alma adımıdır. İndirilen inceleme raporu
  izlenen değişiklikleri de içerir.

Yazar bilgisi `user: { id, name }` ile verilir. Sunucu `trackChanges: true` ile modu zorunlu
kılabilir; kullanıcı bu durumda izlemeyi kapatamaz.

```js
const editor = await mountStudioEditor('#icerik', {
  trackChanges: true,
  user: { id: 'u42', name: 'Ayşe' },
})
editor.getTrackedChanges() // [{ id, type, author, authorName, time, inserted, deleted }]
editor.acceptChange(id) // ya da rejectChange, acceptAllChanges, rejectAllChanges
```

`getHTML()` inceleme sürsün diye öneri işaretlemelerini korur. `getPublicHTML()`, DOCX ve Markdown
dışa aktarımı çözülmemiş önerileri **içermez**; belge önerilerin reddedilmiş haliyle yayınlanır.

**Sınırlar.** Yalnızca metin ekleme/silme ve paragraf bölme/birleştirme izlenir. İzleme açıkken
biçimlendirme, liste, tablo, medya, bileşen, sürükle-bırak ve kaynak kod düzenleme bir uyarıyla
reddedilir; bunlar için izlemeyi kapatın. Yapıştırılan biçim ve dosyalar izlenmez (yapıştırma metne
dönüşür). Değişiklikler yorumlara veya bildirimlere bağlı değildir; yazarlar yalnızca kimlikleriyle
ayrılır. Bu, Word'ün revizyon biçimi değildir: DOCX çıktısında izlenen revizyonlar bulunmaz.

## Kısıtlı düzenleme

Yazar **Düzenle → Düzenlenebilir alan yap** ile alanları işaretler: tek paragraf içindeki seçim
satır içi alan (`span[data-studio-editable]`), birden fazla bloğa yayılan seçim blok alanı
(`div[data-studio-editable]`) olur. İsteğe bağlı ad (`musteri_adi`) alanı tanımlar.
**Düzenle → Kısıtlı düzenleme modu** son kullanıcı deneyimini önizler.

Kısıtlı modda yalnızca alanlar değişir. Alan dışında yazma, silme, yapıştırma ve IME girişi
reddedilir; satır içi alanlar yalnızca metin kabul eder (Enter yok); Tab ve Shift+Tab alanlar
arasında gezinir, Ctrl+A geçerli alanı seçer. Her kayıtta kilitli içeriğin önceki ve sonraki hali
karşılaştırılır; böylece başka giriş yolları da onu değiştiremez. Geri alma, kısıtlı mod dışında
yapılmış düzenlemelere geçmeden durur. Sunucu güncellemeleri (`setHTML`, `v-model`, iş birliği)
uygulanmaya devam eder.

```js
mountStudioEditor('#sozlesme', { restricted: true }) // kullanıcı moddan çıkamaz
editor.getEditableRegions() // [{ name, kind: 'inline' | 'block', text, html }]
```

Belge HTML'ine çalışma zamanı niteliği eklenmez; iki modda da aynıdır. **Sınırlar.** Alanlarda
yalnızca satır içi biçim, bağlantı ve geri alma kullanılabilir; yapısal komutlar kapalıdır. Alanlar
iç içe olamaz. Gönderilen belgelerin sunucu tarafında doğrulanması uygulamanın sorumluluğundadır.

## Canlı imleçler ve varlık

Diğer kişilerin imleç ve seçimleri belgenin üzerinde ad etiketiyle çizilir; belgedeki kişiler
durum çubuğunda görünür. Seçimler taşınabilirdir (üst düzey blok kimliği + metin konumu), bu yüzden
aynı paylaşılan modeli gösteren her editöre uygulanabilir.

```js
const stop = editor.subscribeSelection((selection) => gonder(selection)) // kendi aktarımınız
editor.setRemoteSelections([{ id: 'u7', name: 'Mehmet', selection }])
```

`connectSharedRoom({ getSelection: () => editor.getSelectionAnchor(), onPresence })` imleci her
senkronizasyonda gönderir; örnek sunucu doğrulayıp varlık listesinde döndürür. **Sınırlar.** Örnek
HTTP aktarımı saniyede bir yoklar; imleçler bu gecikmeyle hareket eder. Eş zamanlı yapısal düzenleme
hâlâ deneyseldir ([BETA10.md](BETA10.md)).

## Sayfa görünümü

**Görünüm → Sayfa görünümü** belgeyi yazdırma kâğıdı boyutunda (A4/Letter, dikey/yatay, kenar
boşlukları **Sayfa düzeni ve dışa aktarım** penceresinden) sayfalar halinde, kesik çizgili sayfa
sınırları ve durum çubuğunda geçerli sayfa numarasıyla gösterir. Kırılımlar açık sayfa sonlarına
uyar ve blokları bütün olarak sonraki sayfaya taşır; bir sayfadan uzun bloklar bölünür. Belge
HTML'ine bir şey eklenmez. **Sınırlar.** Sınırlar ekran tahminidir; son kırılımları tarayıcının
yazdırma motoru belirler (dul/yetim satırlar, tablo satırları). Üst ve alt bilgi yalnızca
yazdırma/PDF ve DOCX çıktısında görünür.

## Mermaid diyagramları

**Ekle → Diyagram (Mermaid)**, araç çubuğu düğmesi veya `/diyagram` komutu örnekler (akış şeması,
sıralama, Gantt, sınıf, durum, pasta), canlı önizleme, sözdizimi hataları ve alternatif metin
içeren düzenleyiciyi açar. Diyagram görsel (PNG; HTML etiketi gerektiren türlerde SVG) olarak,
URI kodlu kaynağı `data-studio-source` içinde saklanır; düzenlemek için çift tıklayın. Mermaid
`securityLevel: 'strict'` ile çalışır ve yalnızca pencere açıldığında yüklenir. **Sınırlar.**
Dışa aktarılan HTML/DOCX'te diyagram statik görseldir; kaynak yalnızca editörde yeniden çizilir.
`studio-editor/lite` içinde yoktur.

## Koyu tema

Bağımsız uygulamada yan menüde **Görünüm teması: Sistem / Açık / Koyu** seçimi vardır (bu tarayıcıda
saklanır). Gömülü editörler `theme="light" | "dark" | "auto"` kullanır (varsayılan `light`).
Menüler, araç çubukları, paneller, diyaloglar ve sayfanın gövdesine taşınan açılır pencereler temayı
izler. Koyu kurallar derlemede açık stillerden üretilir (`scripts/dark-theme-css.mjs`): yüzeyler
koyulaşır, metin açılır, doygun vurgu renkleri korunur. Birim testleri ana yüzey/metin çiftlerinde
WCAG AA kontrastını denetler. **Sınırlar.** Belge sayfası kendi renklerini korur (beyaz kâğıt);
içerik renkleri yayınlanacak sayfaya aittir.

## Çökme sonrası toparlama

Editör içindeki bir olay işleyicisi veya bileşen hata verirse editör son HTML'iyle yeniden
başlatılır ve bir bildirim gösterilir. Bir dakika içinde üçten fazla hata olursa editör durur ve
**Editörü yeniden başlat** düğmesi sunar; böylece tekrarlanan bir hata döngüye girmez. Uygulama
`onCrash` / `@crash` / `studio-crash` ile `{ error, recovered, html }` bilgisini alır. Yeniden
başlatmada geri alma geçmişi ve açık diyaloglar kaybolur, içerik kaybolmaz.

## Çevrimdışı çalışma alanı (PWA)

Bağımsız sürüm uygulama olarak kurulabilir (manifest ve simgeler) ve ilk ziyaretten sonra
çevrimdışı çalışır: `sw.js` uygulama kabuğunu önbelleğe alır, ardından isteğe bağlı özellikleri
(MathJax, Mermaid, CodeMirror, Mammoth) tarayıcı veri tasarrufu istemiyorsa arka planda indirir.
Yeni sürüm, kullanıcı **Güncelle ve yenile** diyene kadar bekler; önce belgeler kaydedilir. Service
worker başka alan adlarına giden istekleri hiç ele almaz; uzak medya ve API'ler etkilenmez. `sw.js`
dosyasını `Cache-Control: no-cache` ile sunun. Otomatik test tarayıcıları adreste `?pwa` yoksa
kaydı atlar.

## AI yanıt akışı

Yardımcı adaptörler akış sağlayabilir: `generate(input, { signal, onText })` — biriken metinle
`onText` çağrıldıkça diyalog metni geldikçe gösterir. Son metin yine doğrulanır ve seçimi
değiştirmeden önce incelenir. `createHttpAssistanceAdapter({ baseUrl, stream: true })`
`text/event-stream` ister, JSON yanıtları da kabul eder; özel adaptörlerde
`readAssistanceStream(response, { onText, signal })` `{"delta"}`, `{"text"}`, `{"error"}` ve
`[DONE]` SSE olaylarını okur.

## `<studio-editor>` Web Component

```html
<link rel="stylesheet" href="./editor/studio-editor.css" />
<script type="module">
  import { defineStudioEditorElement } from './editor/studio-editor.js'
  defineStudioEditorElement()
</script>
<form>
  <studio-editor name="icerik" required height="460" theme="auto">
    <template><p>Başlangıç HTML'i</p></template>
  </studio-editor>
</form>
```

Öğe formla ilişkilidir: HTML'ini `name` adıyla gönderir, formla sıfırlanır ve `required`
geçerliliğini bildirir. Nitelikler: `value`, `locale`, `theme`, `placeholder`, `direction`,
`readonly`, `disabled`, `required`, `restricted`, `track-changes`, `height`, `toolbar`, `menubar`,
`content-css`, `body-class`, `paste-mode`, `table-paste-style`, `allow-create-mention` ve
`disable-features` (boşlukla ayrılır). Nesne seçenekleri özellik olarak verilir (`features`,
`mentions`, `messages`, `mediaAdapter`, `assistanceAdapter`, `documentSession`, `user`). Olaylar:
`input`, `change`, `studio-ready`, `studio-save`, `studio-transaction`, `studio-crash`. Light DOM'da
çizildiği için stil dosyasını bir kez ekleyin. React, Angular, PHP veya düz HTML sayfalarında Vue
uygulaması kurmadan çalışır.

## `studio-editor/lite`

`studio-editor/lite` (ve `studio-editor/lite/browser`), MathJax, OpenChemLib, Mammoth ve Mermaid
olmadan aynı API'dir: tam ES paketinin 14,7 MB'ı yerine diskte 1,8 MB. İki sürüm de 0,4 MB'lık giriş
modülü yükler ve isteğe bağlı özellikleri gerektiğinde indirir; lite bu dosyaları hiç içermez.
`science`, `wordImport` ve `diagrams` özellikleri lite sürümde her zaman kapalıdır.

```js
import { StudioEditor } from 'studio-editor/lite'
import 'studio-editor/lite/style.css'
```

## Gerçek CMS entegrasyonu (CodeCMS)

Studio, CodeCMS'in kendi sunucusunda barındırılan TinyMCE (GPL) içerik editörünün yerine ayrı bir
dalda takıldı. CodeCMS; Vue 3 + Pinia 3 admin paneli, Express + MongoDB backend ve Nuxt sitesinden
oluşur. `StudioContentEditor.vue` TinyMCE'nin prop'larını korur, CMS'in koyu modunu `theme`'e
bağlar ve Studio medya kütüphanesini CMS dosya API'sine (`/api/files`, `/api/files/upload`)
bağlar. Gerçek backend ve veritabanına karşı çalışan uçtan uca senaryo; giriş yapar, yazı yazar,
Word HTML'i yapıştırır, görseli CMS üzerinden yükler, kaydeder, yazıyı yeniden açar, koyu moda
geçer ve yayınlanan yazıyı herkese açık sitede gösterir.

Bu sayede Studio'da düzeltilenler: Pinia eş bağımlılığı artık Pinia 3'ü kabul ediyor; yapıştırılan
`<b>`/`<i>` `<strong>`/`<em>` olur (araç çubuğu bunları yalnızca yüklenen belgelerde tanıyordu);
paragraf sonuna liste yapıştırmak artık imlecin giremediği boş bir paragraf bırakmaz; sıralı Word
listeleri gereksiz `value` numaraları taşımaz; belge kâğıdı koyu arayüzlerde beyaz kalır.
CodeCMS'te bulunan ve entegrasyon dalında düzeltilenler: `/posts/new` düzenleme ekranı gibi
işleniyordu, boş kategori MongoDB dönüşümünde hata veriyordu ve taslaklar `superadmin`/`editor`
kullanıcılardan gizleniyordu.

## Erişilebilirlik ve telefon denetimleri

- `tests/accessibility.spec.js`, çalışma alanını, menü çubuğundaki her menüyü, inceleme paneli
  sekmelerini ve önemli diyalogları açık ve koyu temada axe-core (WCAG 2.1 A/AA) ile tarar; ciddi
  veya kritik ihlal kalmamasını şart koşar. Bu tarama ikincil metinlerin koyulaştırılmasını (en az
  4,5:1) ve erişilebilir adların görünen değeri içermesini sağladı (“Yazı tipi: Arial”, WCAG 2.5.3).
- `mobile-chrome` (Pixel 7) ve `mobile-safari` (iPhone 14) projeleri `tests/mobile-*.spec.js`
  dosyalarını mobil kullanıcı ajanı, dokunmatik giriş ve telefon ekranıyla çalıştırır. Bu projeler
  WebKit'in `pointerdown` engellendiğinde tıklamayı iptal ettiğini ve iPhone'da araç çubuğu ile
  menü düğmelerinin dokunmaya tepki vermediğini ortaya çıkardı; düğmeler artık bunu yalnızca fare ve
  kalem girişinde engelliyor.
- Bunlar otomatik emülasyondur. Kararlı sürüm öncesinde fiziksel telefonlarda, VoiceOver, TalkBack
  ve NVDA ile oturumlar yine gereklidir.

## Kalite kapıları

- `npm run lint`: ESLint (doğruluk kuralları) ve `scripts/check-api.mjs`; çalışma zamanı dışa
  aktarımları, bileşen yöntemleri veya prop'lar `index.d.ts` ile uyuşmazsa başarısız olur.
- `npm run typecheck`: tip tanımlarını ve tipli tüketici örneğini TypeScript ile denetler.
- `RichEditor.vue` `src/components/rich-editor/` altına bölündü (menüler, araç çubuğu, açılır
  menüler, diyaloglar, bul ve değiştir, seçenekler, düzenleme modları); ortak durum parçalara
  `provide` ile verilir.
- `.github/workflows/publish.yml`, `v*` etiketlerinde sürüm tarball'ının doğrulanmış kopyalarını
  yayımlar: iş akışı token'ıyla GitHub Packages'a `@metinweb/studio-editor` olarak, `NPM_TOKEN`
  gizli anahtarı tanımlıysa npmjs.org'a provenance ile `studio-editor` olarak (beta sürümler `beta`
  etiketini kullanır). Ayrıntılar: [RELEASE.md](RELEASE.md).
