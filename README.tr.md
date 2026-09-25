# Studio Editor

Varsayılan dil İngilizcedir. Yan menüdeki **Interface language → Türkçe** seçimi kalıcıdır; belge içeriğini değiştirmez. [Türkçe tanıtım sayfası](https://metinweb.github.io/studio-editor/tr/).

[Tanıtım sayfası](https://metinweb.github.io/studio-editor/) · [Canlı demo](https://metinweb.github.io/studio-editor/demo/) · [English](README.md) · [Katkı rehberi](CONTRIBUTING.md)

Studio, **TinyMCE kullanmayan** bir Vue 3 + Pinia içerik uygulamasıdır. Görsel editörün motoru bu proje içinde yazılmıştır; TinyMCE, TipTap, ProseMirror, Lexical veya başka bir hazır görsel editöre dayanmaz. HTML kaynak kodu penceresinde CodeMirror, HTML temizlemede DOMPurify kullanılmaya devam eder. Dolayısıyla uygulamanın tamamı bağımlılıksız değildir.

İki dağıtım hazırlanır: bağımsız web uygulaması ve Vue bileşeni. Proje [MIT lisansıyla](LICENSE) açık kaynaktır. Vue paketi henüz npm'ye yayımlanmadı; kaynak veya yerel `.tgz` üzerinden kullanılabilir.

- [Araştırma ve öncelikli yol haritası](docs/ROADMAP.md)
- [Beta.10 yenilikleri ve kullanım](docs/BETA10.md)
- [Favoriler, etiketler ve belge arama](docs/DOCUMENT-LIBRARY.md)
- [12 başlığın uygulama durumu](docs/IMPLEMENTATION-PROGRESS.md)
- [İşlem, seçim, geçmiş ve medya mimarisi](docs/ARCHITECTURE.md)
- [Vue paketinin kullanımı ve API](packages/editor/README.md)
- [Paketleme ve yayın kontrol listesi](docs/RELEASE.md)
- [Web sunucusuna kurulum](docs/DEPLOYMENT.md)
- [Office ve tablo yapıştırma](docs/PASTE.md)
- [Çoklu hücre seçimi ve sütun boyutlandırma](docs/TABLES.md)
- [Gerçek tarayıcı performans ölçümü](docs/BROWSER-PERFORMANCE.md)

## Çalıştırma

Node.js 22.12+ (24.5 ile doğrulandı):

```sh
npm ci
npm run dev
```

Üretim çıktısı:

```sh
npm run build
npm run preview
```

`dist/` herhangi bir statik HTTP sunucusunda çalışır; göreli yollar sayesinde alt klasöre de konabilir. Örneğin `C:\htdocs\studio` klasörü Apache üzerinden `/studio/dist/` ile açılabilir. Kaynak `index.html` geliştirmede Vite ile çalıştırılmalıdır. `file://` yerine HTTP, uzak erişimde HTTPS kullanın.

Web ZIP'i ve npm tarball'ı oluşturmak ve gerçek tüketici projesinde doğrulamak:

```sh
npm run package:release
npm run verify:release
```

Çıktılar `release/` altında oluşur. Bu komutlar gerçek yayın yapmaz.
Vue bileşeni `v-model`, `ready`, `change`, `save` olaylarını; `getHTML`,
`getPublicHTML`, `setHTML`, `insertHTML`, `focus`, `undo`, `redo`,
`getDocument`, `getHistoryStats`, `openMedia` ve `openSource` metotlarını sunar.
`transaction` olayları ve `mediaAdapter` sağlayıcı sözleşmesi de mevcuttur. Medya ve kaynak pencereleri
pakete dahildir. Paket belgenizi otomatik kaydetmez; `save` olayını kendi
API'nize bağlamanız gerekir.

Beta.3 ile `readonly`, `disabled`, `placeholder`, araç grubu/menü seçimi ve
editöre özel `locale`/`messages` seçenekleri eklendi. Çekirdek arayüz Türkçe ve
İngilizceyi destekler; gelişmiş panellerin çevirileri henüz tamamlanmadı.
Seçenekler belgeyi veya undo geçmişini sıfırlamadan değişir. Çalışan kullanım
örneği `examples/vue/App.vue`, ayrıntılı sözleşme [Vue API belgesindedir](packages/editor/README.md).

## Görsel editör

Beta.6, seçili hücreleri yatay/dikey birleştirme ve ayırmayı; birleşik
hücreli tablolarda satır/sütun ekleme-silmeyi getirir. İşlemler tablo
koordinatlarına göre uygulanır ve tek adımda geri alınır.

Beta.5, çoklu hücre seçimi (sürükleme, Shift+tık, Alt+Shift+ok), sütun sınırından
boyutlandırma ve mevcut hücrelere TSV/HTML matris yapıştırma ekler. Seçili
hücreler kopyalanabilir, kesilebilir ve temizlenebilir; değişimler tek undo adımıdır.

Beta.9: Tablo menüsünde hedef/kaynak hücre biçimi seçimi; Vue tablePasteStyle
prop ve v-model desteği. Kaynak renk, kenarlık, hizalama ve tipografi aktarımı.

Beta.8: HTML tablo yapıştırmada birleşimleri taşıma, normal matrisle birleşik
hedefi ayırma; kısmi hücre/bölüm/taşma koruması ve tek undo.

Beta.7: seçili hücrelere toplu renk, hizalama, iç boşluk ve kenarlık uygulama;
karışık değerleri koruyan Türkçe/İngilizce pencere ve tek adımda geri alma.
[Kullanım ve sınırlar](docs/TABLES.md).

Beta.4, Word liste dönüşümü, Excel/Sheets TSV tabloları, biçimi koru/temizle/metin
seçenekleri ve metin+görselin tek adımda yapıştırılmasını ekler. Vue tarafında
`pasteMode`, `update:pasteMode` ve `paste` olayı kullanılabilir.

- Dosya, Düzenle, Görünüm, Ekle, Biçim, Tablo ve Araçlar menüleri; beyaz araç çubuğu, belirgin mavi seçim durumları ve gruplandırılmış ikonlar. Şablon, yorum ve denetim araçları ikinci araç satırındadır. Dar ekranlarda satırlar kaydırılır veya üç nokta düğmesiyle tüm araçlar genişletilir.
- Belgeyi öne çıkaran kompakt çalışma alanı: ayrıntılar sağ üstteki düğmeyle açılır, kaynak kodu ve önizleme belge başlığının yanındadır. Ortak belge stili Arial 16 px kullanır; içerikte açıkça seçilmiş yazı tipleri korunur.
- Bir üst menü açıldıktan sonra diğer menülerin üzerine gelmek içeriği otomatik değiştirir. Sağ/sol ok tuşları açık menüler arasında geçer; Esc menüyü kapatıp odağı açan düğmeye döndürür. Kapalı menüler yalnızca üzerine gelince açılmaz.
- Yazı tipi, boyut ve paragraf biçimi yerel `select` yerine önizlemeli menülerdir. Seçili seçenek işaretlenir; imleç konumu ve geri alma sonrasında görünen değerler güncellenir. Menüde ok tuşları, Enter ve başlangıç harfiyle seçim desteklenir.
- Kalın, italik, altı/üstü çizili, alt/üst simge; yazı tipi ve boyutu; metin/vurgu rengi.
- Metin ve vurgu rengi için 40 renkli palet, özel HEX kodu, sistem renk seçicisi ve varsayılana dönme. Palet ok tuşlarıyla gezilir; renk uygulama metin seçimini korur ve geri alınabilir.
- Paragraf, başlık, alıntı, kod bloğu; sola/ortaya/sağa/iki yana hizalama.
- Sıralı/sırasız listeler; liste girintisi ve çıkıntısı.
- Bağlantı ekleme/düzenleme/kaldırma ve yeni sekme seçeneği.
- Fare veya ok tuşlarıyla 10 sütun × 8 satırlık ızgaradan tablo seçme; canlı boyut önizlemesi, isteğe bağlı başlık satırı ve özel boyut penceresiyle 20 satıra kadar ekleme. Satır/sütun ekleme/silme, tablo silme; Tab ile hücreler arasında gezinme.
- Seçili tabloda mavi çerçeve, aktif hücre vurgusu ve tablonun üstünde hızlı işlem ikonları: özellikler, tablo silme, üste/alta satır ve sola/sağa sütun ekleme, satır/sütun silme. Üstte yer yoksa araçlar aşağıya veya görünür alana yerleşir. Özellikler penceresinden açıklama, genişlik ve tablo stili değiştirilir.
- Tablo köşelerinden yatay sürükleme ile genişlik değiştirme; ok tuşlarıyla 1 px, Shift ile 10 px adımlar. Esc iptal eder, tamamlanan sürükleme tek adımda geri alınır. Seçim çerçevesi ve hızlı araçlar belge HTML'sinin dışındadır.
- Medya kütüphanesi; görsel, video, ses, PDF; yapıştırılan veya editöre bırakılan dosyaları ekleme.
- Görsele tıklayınca dört köşe ve dört kenar tutamacı; kare zamanlamasına (`requestAnimationFrame`) göre güncellenen boyutlandırma ve canlı piksel ölçüsü. Oran kilidi kapatılabilir; sürüklerken Shift kilidi geçici olarak tersine çevirir. Tutamaca odaklanınca ok tuşları 1 px, Shift + ok tuşları 10 px değiştirir. Esc sürüklemeyi iptal eder; tamamlanan sürükleme tek adımda geri alınır.
- Görseller için %25/%50/%100 genişlik, sola/ortaya/sağa hizalama; alternatif metin ve elle genişlik düzenleme. Görsel kontrolleri belge HTML’sinin dışında tutulur, dışa aktarıma dahil edilmez.
- Görselin yanında kayan araç çubuğu; çift tık veya **Resmi düzenle** ile yerleşik resim editörü. Serbest / 1:1 / 4:3 / 16:9 kırpma, sürüklenebilir alan ve hassas piksel alanları; 90° döndürme, yatay/dikey çevirme, parlaklık/kontrast/doygunluk, siyah beyaz ve orijinalle karşılaştırma. Çıktı boyutu ayarlanır, PNG/JPEG dosyası üretilir; renk değişiklikleri CSS filtresi yerine gerçek çıktı piksellerine işlenir. Uygulama yeni medya kopyası oluşturur, seçili görselin açıklamasını korur ve tek işlem olarak geri alınır. Vazgeçmek belgeyi değiştirmez.
- Metin, bağlantı, tablo ve görsele göre sağ tık menüsü: ilgili düzenleme işlemleri, kes/kopyala/yapıştır, tümünü seç ve geçmiş. Shift+F10 ile klavyeden açılır; Shift+sağ tık tarayıcının kendi menüsünü korur. Panoya erişim engellenirse metin silinmeden klavye kısayolu gösterilir.
- Belge içinde bul/değiştir, Türkçe harf karşılaştırması, büyük/küçük harf seçeneği.
- Geri al/yinele, klavye kısayolları, tam ekran, biçimlendirme temizleme.
- HTML kaynak kodu, güvenli önizleme ve HTML içe/dışa aktarma.

## Gelişmiş içerik araçları

TinyMCE'nin premium ürün kategorilerinden esinlenen bu araçlar, projenin kendi motorunda uygulanmıştır; TinyMCE premium eklentileri yüklenmez.

- **Yorumlar:** Metin seçip yorum yazma, yanıtlama, çözme/yeniden açma, silme ve geri alma. Bir yorum birden fazla paragrafı kapsayabilir. Yorumlar belgeyle tarayıcıya kaydedilir; kullanıcılar arasında paylaşılmaz. Aynı metne iç içe konuşmalar yerine mevcut konuşmaya yanıt eklenir. Yorumu taşıyan metin tamamen silinirse yorum da kaldırılır.
- **Şablonlar:** Proje özeti, toplantı notları ve editoryal yazı; başlık/hazırlayan alanları ve canlı, sandbox içindeki önizleme. Mevcut belge kişisel şablon olarak kaydedilebilir. Şablonlar `studio-content-tools` IndexedDB veritabanında tutulur; kaydetme hataları gösterilir. Ekleme imleç konumunda yapılır ve geri alınabilir.
- **Gelişmiş tablolar:** Seçili sütuna göre Türkçe/sayısal artan-azalan sıralama; başlık satırları ve tablo bölüm sınırları korunur. Sağdaki hücreyle yatay birleştirme ve tekrar sütunlara ayırma; klasik/şeritli/sade stiller. Hücre ayrıldığında mevcut içerik ilk hücrede kalır.
- **Biçim kopyalama:** Biçim menüsünden yazı tipi, boyut, kalınlık, eğiklik, metin dekorasyonu ve renkleri kopyalama; hedef metne uygulama.
- **Büyük/küçük harf:** Türkçe `i/İ` ve `ı/I` dönüşümünü koruyan seçili metin işlemleri.
- **İçindekiler:** H1–H3 başlıklara bağlantılar üretir. Başlıklar değişince Ekle menüsündeki aynı komut mevcut listeyi yeniler; her tuşta otomatik güncellenmez.
- **Temel erişilebilirlik denetimi:** Eksik `alt`, adsız bağlantı, başlıksız tablo, boş başlık ve atlanan başlık düzeyleri. Görsel açıklaması, bağlantı adı ve tablo başlığı düzeltmeleri geri alınabilir. Tam WCAG denetimi veya uygunluk belgesi değildir; kontrast ve klavye erişimini ölçmez.

Yorumlar, HTML kaynak görünümünde `data-studio-thread` içinde saklanır. Önizleme, HTML dışa aktarımı ve kişisel şablonlar yorum metnini kaldırır; dışa aktarılan HTML yorumları yedeklemez. Biçimlendirme ve belge metni korunur.

| Kısayol                            | İşlem                                              |
| ---------------------------------- | -------------------------------------------------- |
| Ctrl / ⌘ + B, I, U                 | Kalın, italik, altı çizili                         |
| Ctrl / ⌘ + Z                       | Geri al                                            |
| Ctrl / ⌘ + Shift + Z veya Ctrl + Y | Yinele                                             |
| Ctrl / ⌘ + S                       | Hemen kaydet                                       |
| Ctrl / ⌘ + F                       | Belge içinde ara                                   |
| Tab / Shift + Tab                  | Tabloda hücre değiştir; listede girintiyi değiştir |
| Esc                                | Tam ekrandan veya arama panelinden çık             |

## Motorun yapısı

```text
src/editor/
  engine.js       DOM işlemleri, metin girişi, biçimlendirme, tablo, liste, yapıştırma, arama
  selection.js    Seçim konumları, imleç geri yükleme, kısmi biçimlendirme sınırları
  history.js      Gruplanan, bellek sınırına sahip işlem geçmişi
  operations.js   Tersine çevrilebilir HTML/kimlik farkları ve metin konumu eşleme
  identity.js     HTML dışında tutulan oturum içi blok kimlikleri
  features.js     Yorum, tablo sıralama/birleştirme, biçim kopyalama, denetim ve içindekiler
src/components/
  RichEditor.vue  Vue araç çubuğu, form pencereleri ve motorun uygulamaya bağlantısı
  EditorPopover.vue Menü konumlandırma, odak ve dışarı tıklama yönetimi
  ColorPalette.vue Renk paleti, özel renk ve klavye seçimi
  TablePicker.vue Tablo boyutu ızgarası
  ImageControls.vue Görsel seçim çerçevesi ve boyutlandırma tutamaçları
  ImageEditor.vue Yerleşik kırpma, döndürme, renk ayarları ve çıktı penceresi
  EditorContextMenu.vue İçeriğe göre sağ tık işlemleri ve pano erişimi
  TableControls.vue Tablo seçim çerçevesi, kayan hızlı araçlar, özellikler ve genişlik tutamaçları
  ReviewPanel.vue Yorum konuşmaları ve erişilebilirlik önerileri
  TemplateLibrary.vue Hazır/kişisel şablonlar ve önizleme
  rich-editor.css
  SourceEditor.vue
  MediaManager.vue
  AppDialog.vue
src/stores/
  workspace.js    Belgeler ve sıralı otomatik kayıt
  media.js        Medya kütüphanesi
  templates.js    Kişisel şablonların kalıcı kaydı
src/lib/
  database.js     IndexedDB erişimi
  media-service.js Editöre özel medya sağlayıcısı, ilerleme, iptal ve tekrar deneme
  media-url.js    Desteklenen dosya türleri ve güvenli medya URL denetimi
  content.js      HTML temizleme, metin sayımı, dışa aktarma
  document.css    Editör/önizleme/dışa aktarım için ortak belge stili
  image-edit.js   Canvas dönüşümleri, piksel ayarları ve PNG/JPEG çıktısı
```

Tarayıcının `contenteditable`, `Selection`, `Range`, `beforeinput` ve kompozisyon olayları kullanılır. **`execCommand` kullanılmaz.** Tarayıcı metni yerinde düzenler; Vue her tuş vuruşunda düzenleme DOM'unu yeniden oluşturmaz. Belge stilleri uygulamadan ayrı bir iframe içindedir. İframe'in CSP politikası `script-src 'none'` ile belge betiklerini engeller. WebKit'te üst sayfanın kaydettiği olay dinleyicilerinin çalışabilmesi için sandbox, `allow-same-origin allow-scripts` kullanır; betik engelleme CSP ve HTML temizliğiyle sağlanır. Önizleme daha kısıtlı, boş sandbox kullanır.

Araç işlemleri işlem geçmişine tek adım olarak yazılır. Bitişik yazma/silme işlemleri 750 ms penceresinde birleştirilir. Geçmiş bir güncel belge ve en fazla 79 tersine çevrilebilir HTML/blok kimliği farkı tutar. Farkların yaklaşık boyut bütçesi 16 MiB'dir; en az bir undo korunduğundan büyük tek işlem sınırı aşabilir. Değişmeyen gömülü görseller küçük komşu metin değişikliklerinde tekrar saklanmaz. DOM hâlâ asıl belge modelidir; her commit'te HTML okuma ve fark hesaplama sürer. İşlem olayları CRDT veya anlamsal belge modeli değildir. Ölçüm ve sınırlamalar [mimari belgesinde](docs/ARCHITECTURE.md) açıklanır.

`RichEditor.vue`, `modelValue`, `update:modelValue`, `media`, `source`, `ready`, `save` olaylarını ve `insert`, `replace`, `rememberSelection` metotlarını sunar. Motor Vue/Pinia'dan bağımsızdır; bir düzenlenebilir HTML öğesi ve callback'lerle başlatılabilir.

## Veri ve güvenlik

Belgeler ve medya tarayıcıdaki IndexedDB'de saklanır. Önceki sürümün belgelerini korumak için veritabanının eski `tinymce-studio` adı değiştirilmemiştir; bu ad bir TinyMCE bağımlılığı değildir. Aynı tarayıcı profili ve aynı origin kullanılmalıdır. Port/protokol/adres değişirse başka depolama alanı açılır.

Bağımsız web uygulaması varsayılan olarak yerel çalışır; oturum açma veya cihazlar arası senkronizasyon yoktur. Vue bileşenindeki `mediaAdapter` ile kendi sunucunuza bağlanabilirsiniz; backend bu depoda bulunmaz. Yerel tarayıcı verileri temizlenirse içerikler silinir. HTML dışa aktarma ile yedek alın. Varsayılan medya data URL olarak belgeye gömülür; yerel kütüphaneden silinen dosyanın mevcut belgelerdeki kopyaları korunur. Sunucu sağlayıcısından veya elle girilen uzak medya URL'leri uzak kalır; sunucudan silinmeleri belgeleri etkiler.

JPEG/PNG/GIF/WebP/AVIF, MP4/WebM, MP3/WAV/OGG ve PDF desteklenir; dosya başına 12 MB. HTML içe aktarma sınırı 30 MB. Oynatılabilir codec'ler tarayıcıya bağlıdır.

HTML, DOMPurify ile temizlenir; script, olay işleyicileri, iframe/object/embed, form öğeleri ve belgeye gömülü stil etiketleri kaldırılır. Güvenli inline stiller korunur. Dışa aktarma ve önizleme aynı temizleme adımını kullanır. Kaynak kodu alanı JavaScript çalıştırma ortamı değildir.

## Kapsam ve sınırlar

Bu, çalışan ilk bağımsız sürümdür; TinyMCE'nin bütün özelliklerinin birebir karşılığı değildir:

- Yatay/dikey hücre birleştirme, dikdörtgen hücre seçimi ve birleşik tablolarda satır/sütun işlemleri desteklenir. İç içe ve düzensiz tablolarda bazı işlemler koruma amacıyla kapatılır; ayrıntılar [tablo belgesindedir](docs/TABLES.md).
- Karmaşık Word/Excel yapıştırmalarının birebir biçim korunması, tam otomatik değişiklik izleme, DOCX içe aktarma ve gelişmiş sayfalama yoktur. DOCX dışa aktarma ve tarayıcı PDF yazdırma mevcuttur. Yjs tabanlı ortak düzenleme deneysel aşamadadır.
- Temel IME kompozisyon akışı otomatik test edilir; tüm mobil klavyeler ve işletim sistemi IME'leri için cihaz testi yapılmış değildir.
- Geri alma geçmişi aktif editör oturumuna aittir; belge değişince veya sayfa yenilenince sıfırlanır. Belgenin içeriği kalıcıdır.
- Büyük belge ve medya senaryoları için tarayıcı ölçümleri [performans belgesinde](docs/BROWSER-PERFORMANCE.md) bulunur; bütün fiziksel cihazlar için bir performans garantisi değildir.
- Resim editörü yerel/yüklenmiş görselleri ve CORS izni veren harici görselleri işler. İzin vermeyen harici sunucular için dosyanın medya kütüphanesine yüklenmesi gerekir. Düzenleme en fazla 8192 px kenar ve 16 megapiksel ile sınırlıdır; kayıt mevcut 12 MB medya sınırına tabidir. Animasyonlar tek kareye dönüşür; JPEG şeffaf alanları beyaz yapar.

## Testler

```sh
npx playwright install chromium --only-shell
npx playwright install firefox webkit
npm run build
npm run test:unit
npm test
```

Yalnızca Chromium:

```sh
npx playwright test --project=chromium
```

`tests/editor.spec.js` motorun gerçek tarayıcı seçimleri, biçimlendirme, listeler, tablolar, yapıştırma, kısayollar, geçmiş ve kompozisyon davranışını sınar. `tests/editor-ui.spec.js` tablo ızgarası, menü odağı, görsel sürükleme/iptal/geri alma, boyutların kayıt ve dışa aktarımda korunması, kaydırma ve mobil yerleşimi sınar. `tests/studio.spec.js` kalıcı kayıt, medya, kaynak kodu, güvenli önizleme, aktarım ve mobil düzeni sınar. Bağımsızlık testi TinyMCE ağ isteklerinin/global nesnesinin bulunmadığını ve `execCommand` çağrılmadığını da doğrular.

`npm run format` kaynakları, testleri, örnekleri ve belgeleri biçimlendirir.

`npm run benchmark:history` saf geçmiş katmanını dört büyük belge senaryosunda
ölçer ve `docs/history-benchmark.json` üretir. Tarayıcı çizimini ve gerçek heap'i
ölçmez. `packages/tests/architecture.spec.js`, işlem olayları ve blok kimlikleri,
özel medya adaptörünün hata/tekrar deneme/iptal/unmount davranışlarını kurulmuş
npm tarball'ında sınar.

`packages/tests/options.spec.js`, salt okunur/devre dışı modları, kaynak görünümü,
geç gelen yükleme sonucunu, boş içerik ipucunu, dil/mesaj ayrılığını ve araç
yapılandırmasını gerçek npm tüketicisinde doğrular.

`tests/editor-interactions.spec.js`, açık menüler arasında fare/klavye geçişini, yazı tipi önizlemesini ve seçim korumasını, tablo çerçevesi/araçlarının konumunu, tablo genişliği/özellikleri ve mobil davranışı sınar. Önceki geliştirmede kullanılan TinyMCE referans dağıtımı artık proje klasöründe değildir.

`tests/content-tools.spec.js`, yorumların kalıcılığı ve yayımlanan HTML'den çıkarılması, şablon kaydı ve güvenli değişkenler, gelişmiş tablo işlemleri, denetim düzeltmeleri, biçim kopyalama, Türkçe harf dönüşümü, içindekiler bağlantıları ve mobil panelleri gerçek tarayıcıda doğrular.

`tests/image-editing.spec.js`, sağ tık hedefleri ve klavye odağı, pano izin hataları ve HTML temizleme, serbest boyutlandırma, çıktı piksel ve boyutları, kırpma/döndürme/çevirme/renk işlemleri, iptal ve geri alma, medya kaydı, CORS hataları, boyut sınırları ve mobil kullanımı doğrular.

`packages/tests/integration.spec.js`, kurulmuş npm tarball'ını ayrı bir Vue
uygulamasında üç tarayıcı motorunda sınar: sayfa stillerinin korunması, iki
editörün içerik/geçmiş ayrılığı, API ve kayıt olayları, yeniden mount,
HTML temizleme, sağ tık, kaynak/medya/resim editörü pencereleri.

## Temizlik ve lisans durumu

Eski motor, tipler, eklenti, tema, ikon, model ve stiller dahil **137 TinyMCE
dağıtım dosyası** proje dışına taşındı. Geri alınabilir arşiv yolu ve bilinçli
uyumluluk referansları [temizlik kaydında](docs/RELEASE.md) açıklanır.

Studio Editor [MIT lisansıyla](LICENSE) yayımlanır; telif sahibi metinweb'dir. Paketlerdeki `private: true` yalnız yanlışlıkla npm yayımını önler; GitHub deposunun herkese açık olmasını veya MIT lisansını etkilemez.
Vue, Pinia, CodeMirror, DOMPurify, idb ve ikon paketinin kendi lisansları devam
eder. `npm run licenses` kurulu üretim bağımlılıklarından lisans metinlerini ve
envanteri üretir; bunlar iki dağıtıma da eklenir.
