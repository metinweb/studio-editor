# İşlem ve medya mimarisi

## Beta.10 uzantıları

Yerel `transaction`/`getDocument` şema 1 HTML sözleşmesi sürer. Eklenen şema 2
`getModel`/`setModel` JSON ağacı, üst blok kimlikleri ve saf `applyModelOperations`
işlemleri DOM'dan bağımsız doğrulanır. Kimlikler artık workspace/sürüm/arşivde
saklanır. DOM düzenleme katmanıdır; bütün komutlar anlamsal işlem üretmez.

`shared-document.js` Yjs ağacına model aktarır; binding yerel işlemleri ve
uzak güncellemeleri ayırır, IME sırasında geleni bekletir, yerel undo'yu Yjs'e
yönlendirir. Uzak model yüklemek başka editörün odağını çalmaz. Bu bağlayıcının
karmaşık eş zamanlı yapısal işlemleri deneysel kalır.

Medya kimliği, imzalı URL yenileme, HTTP sağlayıcısı, belge depolama oturumu ve
eklenti kaydı eklendi. Depolamada beklenen sürümü atomik denetlemek sunucunun
sorumluluğudur; geç yanıtlar yerel taslağı ezmez. Ayrıntılı kullanım ve sınırlar
[Beta.10 belgesinde](BETA10.md). Aşağıdaki bölümler önceki mimariyi ve uyumluluk
sözleşmesini açıklar.

Beta.3 entegrasyon uzantıları aşağıda açıklanır; işlem şeması hâlâ sürüm 1'dir.

## Bileşen seçenekleri — beta.3

`readonly`/`disabled` hem Vue araçlarını hem motorun düzenleme yollarını kontrol
eder. Salt okunur mod seçim, kopyalama ve aramaya izin verir; devre dışı mod
editörü `inert` yapar ve odağı kapatır. İşlem, undo/redo, beforeinput, paste/drop,
IME ve boyutlandırma yollarında kontrol vardır. Mod değişimi açık panelleri
kapatır; o moddan önce başlamış asenkron medya eklemesi belgeyi değiştiremez.
Uygulama kaynaklı `replace`/`v-model` yüklemeleri bu kısıtlamadan ayrı tutulur.

Placeholder bir iframe body özniteliği ve CSS pseudo-element ile gösterilir;
belgenin `innerHTML` çıktısına eklenmez. Dil, toolbar ve menü ayarları iframe'i
yeniden oluşturmaz; belge kimlikleri ve geçmiş korunur. Toolbar/menü kimlikleri
çeviri metinlerinden bağımsızdır. Dil bağlamı Vue provide/inject ile editör
örneğine aittir; global sözlük mutasyonu yapılmaz. Özel mesajlar HTML değil düz
metindir. API ve çeviri kapsamı [paket belgesinde](../packages/editor/README.md).

Bu aşama, mevcut DOM motorunu koruyarak yerel işlemleri, geri alma geçmişini ve
sunucuya bağlanabilir medya sözleşmesini ayırır. Vue/Pinia arayüz katmanındadır;
`src/editor` motoru bu iki pakete bağımlı değildir.

## Yerel işlem sözleşmesi

Beta.9 `tablePasteStyle` tercihi editör örneğine aittir; Vue prop'u ve menü
olayı motorun sonraki pano hazırlama işlemini etkiler. Etkin hücre stili tercihi
hazırlanan pano sonucunda yakalanır; asenkron görsel yüklemesi sırasında seçenek
değişirse başlamış yapıştırmanın tercihi değişmez. Hücre stili aktarımı ayrı
`table-paste-style.js` izin listesinde tanımlıdır; genişlik, konum ve kimlik
aktarımı bu listenin dışındadır. İşlem olayının şeması değişmedi.

Tablo pano aktarımında beta.8, `table-paste.js` ile kaynak/hedef mantıksal
koordinatlarından mutasyon öncesi bir yerleştirme planı üretir. Kısmi hedef
birleşimi ve bölüm sınırları önce denetlenir; başarısız plan geçmişe girmez.
Uygulama hedef başlangıç hücrelerini yeniden kullanır, gerektiğinde stilden
yeni hücre üretir ve ortak `writeCells` doğrulamasını kullanır. Bölge dışındaki
span değerleri normalize edilmez. Bu plan yerel DOM işlemi içindir; taşınabilir
şemalı belge veya ortak düzenleme protokolü değildir.

Her gerçek içerik değişimi `transaction` olayı üretir. `schemaVersion: 1`,
işlem UUID'si, `baseRevision`, artan `revision`, `origin` (`local`, `undo`, `redo`),
`kind`, önceki/sonraki seçimler, blok kimlikleri ve seçim eşleme bilgisi taşır.
Yazarken her değişim olay üretir; aynı yazma grubunun tek undo olması olayları
birleştirmez. Aynı HTML'i yeniden uygulamak revizyon veya undo kaydı oluşturmaz.

```js
{
  schemaVersion: 1,
  origin: 'local',
  baseRevision: 0,
  revision: 1,
  steps: [{ type: 'replaceHtml', from: 3, removed: '', inserted: 'Merhaba' }],
  // id, kind, selectionBefore/After, blockIdsBefore/After, mapping
}
```

Ofsetler JavaScript ve DOM Range gibi UTF-16 birimindedir. Bu sürümde işlem,
ortak önek/son ek arasındaki HTML farkıdır; tablo hücresi ekleme gibi anlamsal
bir komut değildir. Ters işlem eklenen ve çıkarılan metni değiştirir. Geçmiş
uygulamadan önce çıkarılacak bölgenin mevcut belgeyle eşleştiğini denetler.
Komutun değişiklik callback'i hata verirse önceki HTML, kimlikler ve seçim
geri yüklenir; bu, ağ işlemlerini veya tüketici callback'lerini kapsayan bir
veritabanı transaction'ı değildir.

`getDocument()` güncel `{ schemaVersion, revision, html, blockIds }` döndürür.
Revizyon editör oturumuna aittir; mount ile sıfırlanır. Henüz `setDocument` veya
uzaktan işlem uygulama API'si yoktur. Kalıcı belge kaydı için `v-model` / `save`
kullanılır. İşlem olaylarının tamamını saklamak, büyük HTML farkları ve blok
listeleri nedeniyle uygulamanızda ayrıca bellek tüketebilir.

## Geçmişin bellek sınırı

Bir güncel HTML ve blok kimliği dizisi tutulur. Her undo kaydı yalnızca tersine
çevrilebilir HTML ve kimlik dizisi farklarını, önceki/sonraki seçimi saklar.
750 ms içindeki bitişik yazma grupları birleştirilir. Yeni dal redo'yu kaldırır.
Varsayılan sınır 79 geçiş ve yaklaşık 16 MiB fark verisidir. En az bir geçiş
korunduğundan tek büyük işlem bu sınırı aşabilir. Sınır güncel belgeyi kapsamaz.

`getHistoryStats()` içindeki `patchBytes`, serileştirilmiş kayıtların UTF-16
boyut hesabıdır; JavaScript heap ölçümü değildir. `documentBytes` yalnızca HTML
boyutunu hesaplar. Değişmeyen gömülü görsel küçük komşu metin değişimlerinde
tekrar kaydedilmez. Bir işlemin iki uzak bölgeyi değiştirmesi aradaki değişmeyen
HTML'i de farka katabilir; görsel içeriğini tüm koşullarda geçmişten ayırmaz.

## Blok kimlikleri ve seçim

Üst düzey DOM düğümlerine WeakMap içinde UUID atanır. Kimlikler belge HTML'ine,
DOM özniteliklerine veya yayın çıktısına eklenmez. Aynı düğüm metin/biçim
değişiminde kimliğini korur; undo/redo eski kimlikleri yeniden bağlar. Düğümün
yeniden oluşturulması yeni kimlik üretir. Yenileme ve belge içe aktarma boyunca
kalıcılık henüz sağlanmaz.

Seçim yer imleri DOM yollarına ek olarak blok kimliği ve blok içi metin ofseti
taşır. `mapSelection(bookmark, transaction.mapping)` aynı bloktaki metin
ekleme/silme konumlarını eşler; seçimin bağlı olduğu blok silinirse `null`
döndürür. `mapOffset` tek bir ofseti eşler. Bu yardımcılar deneysel yerel
temeldir: biçim nedeniyle metin düğümlerinin ayrılması, düğüm seçimi, blok
bölme/birleştirme ve eşzamanlı değişikliklerin tamamını çözmez. Mevcut yorumlar
henüz bu kimliklere taşınmadı.

## Medya sağlayıcısı

`StudioEditor` bileşenine `mediaAdapter` verilmezse mevcut IndexedDB/data URL
kütüphanesi kullanılır. Verilirse o editör örneğine özel servis oluşturulur.
Aynı sayfadaki yerel veya başka sağlayıcılı editörlerin kayıtları karışmaz.
Adaptörü çalışma sırasında değiştirmek için bileşeni yeni `key` ile mount edin.

```vue
<StudioEditor
  v-model="html"
  :media-adapter="mediaAdapter"
  @upload-progress="(percent) => console.log(percent)"
  @upload-error="(message) => console.error(message)"
  @transaction="(transaction) => console.log(transaction.revision)"
/>
```

Sağlayıcının zorunlu metotları:

| Metot                                       | Sözleşme                                              |
| ------------------------------------------- | ----------------------------------------------------- |
| `list()`                                    | `Promise<MediaAsset[]>`                               |
| `upload(file, { signal, alt, onProgress })` | `Promise<MediaAsset>`; ilerleme 0–1                   |
| `update(asset)`                             | Güncel `MediaAsset` döndürür; UI alt metni günceller. |
| `remove(id)`                                | Sunucudan kaldırma işlemini tamamlar.                 |

`MediaAsset`: `id`, `name`, `type`, `size`, `url`; isteğe bağlı `alt`, `createdAt`
(milisaniye). Hatalar reject/throw ile bildirilir. `label` kütüphane konumunu
açıklayabilir. Desteklenen MIME türleri ve 12 MB sınırı istemcide de denetlenir.
Güvensiz URL veya hatalı kayıt reddedilir; `javascript:`, SVG data URL ve `blob:`
kabul edilmez. URL/alt/ad HTML'e kaçırılarak eklenir.

Servis dosyaları sırayla yükler, toplu ilerlemeyi yüzdeye çevirir, başarısız
dosyaları tekrar deneyebilir. İptal ve unmount `AbortSignal` gönderir; geç gelen
sonuçlar eklenmez. Sağlayıcı sinyali izlemeli ve isteği sonlandırmalıdır; iptal
edilmiş sunucu yazısını geri almak sağlayıcının sorumluluğudur. `list` isteği
iptal edilmez, unmount sonrası sonucu uygulanmaz. Desteklenmeyen dosyalar
yeniden deneme kuyruğuna alınmaz.

Çalışan HTTP adaptör örneği: `examples/vue/media-adapter.js`. GET/POST
`/api/media`, PATCH/DELETE `/api/media/:id` uçlarını bekler. Bu depoda bu uçları
sunan bir backend yoktur. Örnek `fetch` nedeniyle başlangıç/bitiş ilerlemesi
bildirir; ara yüzdeler için sağlayıcı XHR veya kendi aktarım istemcisini
kullanabilir. Testlerde uçlar taklit edilir.

Kimlik doğrulama, dosya içeriği denetimi, kota, sunucu HTML doğrulaması ve erişim
yetkileri uygulamanın backend'inde uygulanmalıdır. Belgeye asset kimliği değil
URL yazılır: kalıcı URL kullanın; süresi dolan imzalı adresleri yenileme henüz
yoktur. Uzak resim düzenleme CORS izni gerektirir. Sunucu kütüphanesinden silme,
o URL'yi kullanan mevcut belgelerde görselin kaybolmasına yol açabilir.

## Ölçüm ve sonraki mimari adım

Beta.5 `table-grid.js` satır/hücre/span bilgisinden sınırlı bir mantıksal matris
üretir. Seçim birleşik hücreleri kesmeden genişler; geçici seçim DOM düğüm
referanslarıyla tutulur ve HTML'e yazılmaz. Mutasyon/undo/mod değişimi seçimi
temizler. Yapıştırma önce bütün hedefi doğrular, ardından tek transaction
uygular; kısmi hücre değişimi yapılmaz. Bu tablo yardımcısı bağımsız bir belge
şeması veya ortak düzenleme modeli değildir. Sütun sürükleme DOM önizlemesini
tek geçmiş adımına dönüştürür; iptalde özgün colgroup ve stiller geri gelir.

Beta.6 `table-operations.js` satır/sütun değişimini önce DOM'a dokunmadan
koordinat girdileri olarak planlar. Girdi sınırları denetlenir; span içeride
büyütülür/küçültülür, yaşayan hücre düğümleri yeniden kullanılır ve satırlara
mantıksal sırayla yerleştirilir. Son matris doğrulanır; hata transaction'ın
geri yükleme yoluna gider. `table-structure.js` motor komutlarını birleştirir;
eski ayrı satır/sütun ve birleştirme kodları kaldırıldı. Model hâlâ yerel DOM
referansları taşır; kalıcı belge şeması veya CRDT protokolü değildir.

`npm run benchmark:history`, 1.000/10.000 paragraf, 100×20 tablo ve 50 gömülü
görsel üzerinde 79 küçük düzenlemeyi ölçer. Sonuçlar `history-benchmark.json`
içindedir. Saf geçmiş işlemini ölçer; DOM, layout, girişten çizime gecikme,
gerçek heap veya rakip editör kıyaslaması içermez. Eski 80 tam kopya sütunu,
eski 16 MiB kırpma sınırı uygulanmadan hesaplanan teorik referanstır.

Sonraki adım DOM'dan bağımsız, şeması doğrulanan belge modeli ve anlamsal
metin/biçim/blok/tablo işlemleridir. Kalıcı kimlikler, yapısal seçim eşleme ve
import/migration sözleşmesi birlikte tasarlanmalı. Sonrasında track changes
ve CRDT bağlayıcısı değerlendirilebilir. Mevcut `replaceHtml` olayları bir CRDT
protokolü olarak ağda birleştirilmemelidir.
