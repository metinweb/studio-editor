# Yerel dağıtım doğrulaması — 24 Eylül 2026

## 0.1.0-beta.10 — çalışma alanı ve ekip iş akışı

- Birim testleri **38/38** geçti: arşiv bütünlüğü/sınırları, model işlemleri,
  komut kaydı, asenkron belge yükleme/kayıt, HTTP medya kimlik doğrulaması,
  CRDT çevrimdışı metin/yerel undo ve gerçek HTTP iş birliği akışı dahil.
- Chromium/Firefox/WebKit tam web taraması **375/375** geçti (4,4 dakika).
  Son küçük değişiklikler olan blok Escape iptali, belge adaptöründe geç yükleme
  koruması ve yardım metinleri bu tam koşudan sonra paketlendi. Escape dahil
  yazım regresyonu son build üzerinde üç tarayıcıda **12/12** tekrar geçti
  (21 saniye); adaptör yarışı son birim koleksiyonuna dahildir.
- Son tarball üzerinde **78/78** paket testi geçti (50,1 saniye): iki örnek
  iş birliği/çevrimdışı birleşim/yerel undo, şema API, İngilizce resim paneli,
  gerçekten paket içinden çalışan WebP Worker'ı, eklenti readonly ve mevcut
  entegrasyon regresyonları. SHA-256/boyut, vendor temizliği, web arşivi,
  gerçek tarball kurulumu, strict TypeScript, SSR import ve tüketici build'i geçti.
- Önceki ara koşularda bulunan hatalar düzeltildi: Firefox'ta ortak editöre
  gelen modelin odağı çalması, sağ tık olayının odak değişiminde farklı öğeye
  gitmesi, WebKit'te blok araçlarının güncellenmemesi, tüketici paketindeki
  resim Worker'ının kayıp dosya adresi. İlgili regresyonlar geçti.
- Masaüstünde yedek, sürüm listesi, slash menüsü ve yazdırma önizlemesi;
  390 px genişlikte çıktı seçenekleri ve kaydırılarak erişilen düğmeler
  görsel olarak incelendi. Ekran görüntüleri `screenshots/beta10/` içinde.
  Chromium gerçek PDF çıktısı `print-sample.pdf` olarak üretildi; Word/LibreOffice
  render doğrulaması yapılmadı. DOCX ZIP/XML, birleşik tablolar, numaralandırma,
  iki ayrı gömülü görsel ve üst/altbilgi üç tarayıcıda test edildi.
- Başlangıç/ilk iyileştirme ölçümleri korundu; bütün yeni özelliklerle
  `workspace-performance-beta10.json` tekrar alındı. Son 10.000 paragraf
  giriş p95 Chromium 46,2 ms, Firefox 38 ms, WebKit 60 ms; yöntem ve sınırlamalar
  [Beta.10](BETA10.md) içinde. Başka editörlerden hızlı olma iddiası değildir.
- Kaynak, bileşen, tip ve test dosyalarının Prettier kontrolü geçti.

Bu sürümde metin önerilerinin kabul/ret akışı vardır; bütün düzenleme
işlemlerini otomatik izleyen Track Changes yoktur. İş birliği karmaşık
eş zamanlı yapı düzenlemeleri bakımından deneysel kalır. Gerçek mobil/IME,
ekran okuyucu, gerçek Office panoları ve üretim altyapısı ayrı kabul gerektirir.
CodeMirror'ın tembel yüklenen kaynak editörü için büyük chunk uyarısı sürer.
Lisans seçilmedi ve dış yayın yapılmadı.

## 0.1.0-beta.9 — kaynak hücre biçimini yapıştırma

- Mevcut birim testleri **24/24** geçti.
- İlgili ilk web koşusunda **119/120** geçti. Firefox dikey hizalama
  aktarımında hata bulundu: CSSOM vertical-align özelliğini alignment-baseline,
  baseline-shift ve baseline-source olarak listeliyordu; temizleyici bunları
  kaldırıyordu. İzin listesi bu alt özellikleri kapsayacak şekilde düzeltildi.
- Son build ile pano ve kaynak hücre stili dosyaları üç motorda **36/36**
  geçti (33,2 saniye). Renk, tipografi, asimetrik kenarlar, iç boşluk, eski
  öznitelikler, birleşimler, tek undo, clean/text/TSV önceliği ve CSS sınırları dahil.
- Son tarball üzerinde **66/66** paket testi geçti (40,7 saniye): dinamik
  tablePasteStyle prop'u, menüden v-model olayı, İngilizce etiketler, örnekler
  arası bağımsızlık, readonly ve mevcut API regresyonları.
- TypeScript yeni prop/olay tipini ve geçersiz değerin reddini doğruladı.
  Hash, allowlist, gerçek tarball kurulumu, SSR import ve tüketici build'i geçti.
- 390 px Tablo menüsü görsel olarak incelendi; yatay taşma görülmedi.
  Değişen kaynak/test dosyaları Prettier kontrolünden geçti.

Beta.9 web ZIP ve Vue tarball yerel hazırlandı; açık yayın yapılmadı. Tam web
koleksiyonu son düzeltmeden sonra tekrar çalıştırılmadı. Gerçek Office pano,
mobil cihaz ve ekran okuyucu doğrulaması bekliyor. Kaynak sınıfları/miras
alınan stiller çözülmüyor; yalnız açık ve izinli hücre stilleri aktarılıyor.
Kaynak editörünün mevcut büyük chunk uyarısı sürer.

## 0.1.0-beta.8 — birleşik tablo pano aktarımı

- Birim testleri **24/24** geçti. Yerleştirme planında farklı boyut/birleşim
  düzenleri, tam kapsama, hücre kimliği yeniden kullanımı, sınır ve bölüm
  reddi mutasyon olmadan doğrulandı.
- Chromium, Firefox ve WebKit'te ilgili web regresyonları **120/120** geçti
  (1,5 dakika): pano, tablo matrisi, yapı işlemleri ve hücre biçimi.
  Yeni sekiz senaryo HTML/TSV dönüşü, iki eksenli span, rowspan=0, tam undo,
  kısmi hedef/bölüm reddi, tek değer, kaynak temizliği ve colgroup korumasını kapsar.
- Son tarball paket testleri **60/60** geçti (35,4 saniye). Excel işaretli
  temsilî HTML, keep/clean/text, mantıksal rows/columns, pasteCells olayı,
  reddedilen işlemde geçmişin korunması, örnek bağımsızlığı ve readonly dahil.
- Hash, allowlist, gerçek tarball kurulumu, TypeScript, SSR import ve tüketici
  üretim build'i geçti. Beta.8 web ZIP ve Vue tarball yerel üretildi.
- Birleşik yapıştırma sonucu ve hedef alan dışındaki hücreler masaüstünde
  görsel olarak incelendi; değişen kaynak/test dosyaları Prettier kontrolünden geçti.

Tam web koleksiyonu bu sürümde yeniden çalıştırılmadı. Gerçek Office sürümleri
ve işletim sistemi panoları ayrıca doğrulanmalı. TSV birleşim bilgisi taşımaz;
HTML gerekir. Kaynak hücre temaları aktarılmaz, hedef stil/tür temel alınır.
Kaynak editörünün mevcut büyük chunk uyarısı sürer. Açık yayın yapılmadı.

## 0.1.0-beta.7 — toplu hücre biçimlendirme

- Birim testleri **21/21** geçti; hücre biçimi taslağında CSS değeri ve sayısal
  sınır doğrulaması eklendi.
- İlgili web regresyonları Chromium, Firefox ve WebKit'te **132/132** geçti
  (1,9 dakika): tablo seçim/pano/yapı/biçim, menüler, resize ve resim işlemleri.
  Bu sürümde bütün web test koleksiyonu yeniden çalıştırılmadı.
- Görsel incelemede örnek hücrenin yeni dolgu rengini hemen göstermediği
  saptandı; Vue reaktif özellik takibi düzeltildi. Son build ile biçimlendirme
  dosyası **15/15** tekrar geçti (26,3 saniye); örnek renk kontrolü de eklendi.
- Son tarball üzerinde paket testleri **51/51** geçti (39 saniye): formatCells
  olayı, örnekler arası bağımsızlık, undo, dışarıdan belge değişince eski taslağın
  reddi, readonly ile taslak iptali ve İngilizce pencere dahil.
- Hash, allowlist, gerçek tarball kurulumu, TypeScript, SSR import ve tüketici
  üretim build'i geçti. Beta.7 web ZIP ve Vue tarball yerel üretildi.
- Masaüstü ve 390 px pencere, örnek hücre ve kaydırılarak erişilen eylem
  düğmeleri görsel olarak incelendi. Kaynak dosyalar Prettier kontrolünden geçti.

Hücre içindeki özel metin/paragraph stilleri ve seçilmeyen komşuların kenarları
korunur; genel metin toolbar'ı toplu hücre biçimi olarak değiştirilmedi.
Gerçek mobil klavye/dokunma, ekran okuyucu ve RTL doğrulaması bekliyor.
Kaynak editörünün mevcut 500 kB chunk uyarısı devam ediyor. Rakiplere göre
performans veya kapsam üstünlüğü ölçülmedi; açık yayın yapılmadı.

## 0.1.0-beta.6 — birleşik hücreler ve yapısal tablo işlemleri

- Birim testleri **20/20** geçti. Yeni planlayıcı testleri span kesişimlerini,
  silinen köken hücrenin korunmasını, `rowspan=0`, boyut sınırlarını ve farklı
  birleşik düzenlerde boşluksuz/çakışmasız koordinatları kapsar.
- Tam web koşusunda **282 testin 280'i** geçti (3,2 dakika). Firefox'taki iki
  matris testi sayfa/kaynak editörü açılışında zaman aşımına uğradı; derlemeler
  ve diğer testler bittikten sonra ayrı çalıştırılan iki senaryo da geçti.
  Zaman aşımının kök nedeni doğrulanmadı; tam koşu sıfır hatalı sayılmıyor.
- Yeni sekiz yapısal tablo senaryosu Chromium, Firefox ve WebKit'te geçti:
  dikdörtgen/dikey birleştirme, iki eksende ayırma, span içinden satır/sütun
  ekleme-silme, bölüm sınırları, son hücreyi silme, Tab ve geri alma.
- Son tarball üzerinde paket testleri **45/45** geçti (38,3 saniye). İşlem
  olayları, geri alma ve iki editör örneğinin birbirinden bağımsızlığı doğrulandı.
- Hash, dosya allowlist'i, gerçek tarball kurulumu, TypeScript, SSR import ve
  tüketici üretim build'i geçti. Beta.6 web ZIP ve Vue tarball yerel üretildi.
- Birleşik hücre seçimi ve genişleyen hızlı araç çubuğu masaüstünde görsel
  olarak incelendi. Gerçek mobil cihaz ve RTL doğrulaması yapılmadı.

Ayırma, birleştirilmiş içeriği sol üst hücrede bırakır; eski dağılım geri almayla
geri gelir. Birleşik hücre içeren matris yapıştırma hâlâ desteklenmiyor.

## 0.1.0-beta.5 — tablo koordinatları ve etkileşimler

- Birim testleri **16/16**: önceki gruplara ek olarak span koordinatları,
  birleşik hücreye göre genişleyen seçim, çakışma/delik/boyut sınırları ve
  `rowspan=0` satır grubu davranışı.
- Son tarball üzerinde paket testleri **42/42** geçti (38,8 saniye); matris
  yapıştırma ve aktif resize sırasında readonly iptali dahil.
- Hash, allowlist, gerçek tarball kurulumu, TypeScript, SSR import ve tüketici
  üretim build'i geçti. Yerel web ZIP ve Vue tarball beta.5 olarak üretildi.
- Masaüstü çoklu seçim, mavi hücre katmanı ve hızlı araçlar görsel olarak incelendi.

İlk tam web koşusunda sütun tutamacına tıklama ve ardından klavyeyle resize
senaryosu üç tarayıcıda hızlı araçları kaybettiriyordu. Yeni colgroup DOM
yollarını kaydırdığı için eski yer imi yanlış konuma dönüyordu. Sürükleme
oturumu canlı DOM Range'i koruyacak şekilde düzeltildi; hedefli senaryo üç
tarayıcıda geçti. Sonraki tam koşuda **257/258** geçti; Firefox'ta sürükleme
sırasında Esc odağı iframe'e geçtiğinde iptal kaçıyordu. Esc dinleyicisi
sürükleme süresince hem iframe belgesinde hem ana belgede yakalama aşamasına
alındı. Boş pano için seçili hücreleri değiştirmeme kontrolü de eklendi.
Bu son değişimlerden sonra etkilenen tablo/yapıştırma/etkileşim grupları ve
gerçek paket testleri yeniden çalıştırıldı; tam grup yeniden koşulmadı.
Son web kontrolü **84/84** geçti (1 dakika); tablo sürükleme/klavye/iptal,
matris aktarımı, boş pano ve mevcut menü/overlay regresyonları dahil.

Kapsam ve kalan sınırlar: [TABLES.md](TABLES.md). Birleşik hedefe çok hücreli
yapıştırma reddedilir; dikey birleştirme, birleşik tablolarda satır/sütun
yapısal işlemleri, RTL tutamaçları ve gerçek dokunmatik doğrulama tamamlanmadı.
Bu betada yeni üçüncü taraf bağımlılığı yoktur. Lisans seçimi ve kamuya açık
yayın yapılmadı; kaynak editörünün mevcut chunk uyarısı sürer.

## 0.1.0-beta.4 — yapıştırma ve tarayıcı ölçümü

- Birim testleri **12/12**: önceki testler ve TSV kaçışları, boş hücreler,
  sınırlar, belirsiz veri, kaynak/fragment algılama.
- Tam web regresyonu Chromium/Firefox/WebKit üzerinde **222/222**, 2,5 dakika.
- Ardından düz metindeki `<img ...>` ifadesinin dosyayı yanlışlıkla mükerrer
  saymasını önleyen kontrol eklendi. Bu son değişimle yapıştırma grubu
  **24/24** geçti (24,8 saniye). Tam web grubunun güncel toplamı 225'tir;
  tam grup bu tek satırlık son korumadan önce koştu.
- Son tarball için hash/allowlist, gerçek npm kurulumu, strict TypeScript,
  sunucu ortamında import ve tüketici build'i doğrulandı.
- Son tarball üzerinde üç tarayıcıdaki paket testleri **36/36** geçti (30,8 saniye).
- Paket senaryoları: editöre özel/dinamik yapıştırma modu, `paste` metaverisi,
  menüden v-model güncellemesi, geç yükleme sırasında değişen belgenin korunması
  ve önceki entegrasyon testleri.
- Masaüstü yapıştırma menüsü ekran görüntüsüyle incelendi.
- [Chromium ölçümü ve sınırları](BROWSER-PERFORMANCE.md): 1.000/10.000 paragraf,
  100×20 tablo ve 50 görsel; fiziksel klavye gecikmesi veya rakip kıyası değildir.

Office uyumu temsilî HTML/TSV olaylarıyla test edildi; gerçek Office uygulaması
ve işletim sistemi panosunun uçtan uca doğrulanması henüz yapılmadı. Matris
yapıştırma, RTF, özel liste şablonları, gerçek mobil/IME kontrolleri bekliyor.
500 kB kaynak editörü chunk uyarısı sürüyor. Lisans seçilmedi, yayın yapılmadı.

Yerel çıktı: `release/studio-editor-0.1.0-beta.4-web.zip` ve
`release/studio-editor-0.1.0-beta.4.tgz`. SHA-256: `release/manifest.json`.

## 0.1.0-beta.3 — entegrasyon seçenekleri

Yeni çalışma konumu: `C:\htdocs\studio`. Web ve npm çıktıları burada oluşturuldu.

| Kontrol                         | Sonuç                                                                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Birim testleri                  | **8/8**: geçmiş/işlem testlerine ek olarak seçenek seçimi ve dil/sözlük önceliği.                                                                                      |
| Mevcut web regresyonları        | Chromium, Firefox ve WebKit'te **201/201**; tam koşu 2,7 dakika.                                                                                                       |
| Kurulmuş npm paketinin testleri | Son beta.3 arşivinde üç motorda **30/30**; 20,4 saniye.                                                                                                                |
| Yeni seçenek senaryoları        | İlk açılışta ve dinamik readonly/disabled, seçim, klavye, paste/drop, kaynak görünümü, dışarıdan içerik güncelleme, mod değişirken açık pencere ve geç yükleme sonucu. |
| Yapılandırma/dil                | Placeholder HTML dışında kalır; dil/mesaj/araç değişimi içeriği ve geçmişi korur; iki editörün ayarları ayrıdır; araçları gizlemek açık menüyü kapatır.                |
| Paket denetimleri               | Hash, dosya içeriği, gerçek tarball kurulumu, tüketici build'i, strict TypeScript ve sunucu ortamında import geçti.                                                    |
| Görsel inceleme                 | İngilizce çekirdek arayüz, salt okunur görünüm ve 390 px sade toolbar incelendi.                                                                                       |

İlk paket koşusunda WebKit, readonly alanda Backspace sonrası `about:blank`
sayfasına geri gitti. Motorun readonly klavye yolu düzeltildi ve aynı senaryo
üç motorda geçti. Son toolbar/menü gözlemcisi değişimi son 30 paket testine
dahildir. Web regresyonları bu değişimden önceki aynı motor derlemesinde çalıştı.

Gelişmiş panellerin tümü İngilizceye çevrilmedi; RTL, gerçek mobil klavye ve
ekran okuyucu testleri bekliyor. Büyük belge girişten çizime ve heap ölçümleri
bu aşamada yapılmadı. Geç yükleme testleri gerçek backend yerine taklit HTTP
uçlarını kullanır. Kaynak editörü için mevcut 500 kB chunk uyarısı sürer.

Yerel dağıtımlar `release/studio-editor-0.1.0-beta.3-web.zip` ve
`release/studio-editor-0.1.0-beta.3.tgz`; hash'leri `release/manifest.json` içindedir.
Herkese açık yayın yapılmadı.

## 0.1.0-beta.2 — mimari aşama

| Kontrol                   | Sonuç                                                                                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:unit`       | **6/6** geçti: UTF-16 farkları, gruplanan geçmiş, redo dalı, boyut sınırı, büyük medya, 10.000 blok kimliği ve seçim eşleme.                                                                                     |
| `npm test`                | Chromium, Firefox, WebKit üzerinde **201/201** geçti (son tam çalıştırma 2,3 dakika).                                                                                                                            |
| `npm run package:release` | Beta.2 web ZIP, Vue npm tarball, lisanslar ve SHA-256 manifest üretildi.                                                                                                                                         |
| `npm run verify:release`  | Son tarball kuruldu; hash/dosya karşılaştırması, strict TypeScript, sunucu ortamında import ve tüketici build'i geçti.                                                                                           |
| Paket tarayıcı testleri   | **15/15** geçti: önceki entegrasyonlar, revizyon/kimlik/undo, aynı HTML'i uygulama, özel medya sağlayıcısı, başarısız ve güvensiz sonuçları tekrar deneme, kütüphane ayrılığı, iptal ve aktif yüklemede unmount. |
| Son UI metni düzeltmesi   | Uzak dosya silme uyarısı belgelere etkisini açıklar; paket testleri bu son derlemeyle çalıştırıldı.                                                                                                              |

İlk denemelerde Firefox şablon testi zaman aşımı ve paket testinde yazım odağı
sorunu görüldü. Şablonun hedefli tekrarı geçti; paket testi yazımdan önce iframe
gövdesine açıkça odaklanacak şekilde düzeltildi. Yukarıdaki son tam çalıştırmalar
başarılıdır. Mobil cihaz ve ekran okuyucu doğrulaması henüz yapılmadı. Medya
sunucusu testlerde taklit edildi; gerçek backend entegrasyonu doğrulanmış değildir.

### Saf geçmiş ölçümü

Node 24.5.0 / Windows üzerinde 79 küçük düzenleme. Rakamlar
`npm run benchmark:history` çıktısıdır; [ham sonuçlar](history-benchmark.json).

| Senaryo                 | Güncel HTML baytı | Geçmiş fark baytı | Commit p50 / p95 |
| ----------------------- | ----------------: | ----------------: | ---------------: |
| 1.000 paragraf          |            64.018 |            23.726 | 0,089 / 0,175 ms |
| 10.000 paragraf         |           640.018 |            24.042 | 0,872 / 1,515 ms |
| 100×20 tablo            |            57.848 |            23.252 | 0,068 / 0,076 ms |
| 50 gömülü görsel URL'si |         4.004.118 |            23.726 | 4,946 / 6,063 ms |

Baytlar UTF-16 ve serileştirilmiş kayıt hesabıdır; gerçek heap ölçümü değildir.
Ölçüm DOM okuma, layout, girişten çizime gecikme ve rakip karşılaştırması içermez.
Görsel URL'leri sentetik veridir; görsel çözme/çizme performansını sınamaz.
Eski 80 tam kopya referansı eski 16 MiB kırpma sınırı uygulanmadan hesaplanır.

Klasör adı değişikliği (`C:\htdocs\tinymce` → `C:\htdocs\studio`) denendi.
Önizleme durdurulmasına rağmen Windows açık işlem kilidi nedeniyle yeniden
adlandırmayı reddetti. Kullanıcı sonraki oturumdan önce klasörü yeniden
adlandırdı; beta.3 çalışması `C:\htdocs\studio` konumunda doğrulandı.

## Önceki paketleme doğrulaması — 0.1.0-beta.1

Paket sürümü: `0.1.0-beta.1`. Bu kayıt yerel çalıştırma sonuçlarını bildirir;
uzak CI veya gerçek mobil cihaz testi yapılmış olduğu anlamına gelmez.

| Kontrol                    | Sonuç                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run package:release`  | Web ZIP + Vue npm tarball + SHA-256 manifest üretildi.                                                                                    |
| `npm test`                 | Chromium, Firefox, WebKit üzerinde **201/201** geçti.                                                                                     |
| `npm run verify:release`   | Artefakt hash ve dosya karşılaştırmaları, eski vendor dosyalarının yokluğu, temiz tüketici kurulumu/derlemesi geçti.                      |
| Paket entegrasyon testleri | Üç motorda **6/6** geçti; iki editör, CSS sınırları, API/undo/kayıt, mount/unmount, tam ekran, kaynak/medya/resim pencereleri, dar ekran. |
| TypeScript                 | Kurulmuş paketin bildirimleri strict/noEmit/skipLibCheck:false ile geçti.                                                                 |
| Sunucu ortamında import    | `window` olmadan paket import edildi. SSR render desteği iddia edilmiyor.                                                                 |
| `npm audit --json`         | Bilinen güvenlik açığı: 0. Bu bir uygulama güvenlik incelemesi değildir.                                                                  |
| Lisans envanteri           | Kurulu üretim bağımlılık ağacından 58 paketin lisans metni toplandı; eş bağımlılıklar dahil.                                              |
| Görsel kontrol             | Ayrı Vue tüketicisinde masaüstü ve 390 px görünüm incelendi; sayfa taşması testi geçti.                                                   |

Üretim build'inde tembel yüklenen CodeMirror kaynak editörü için 500 kB üstü
chunk uyarısı var (web çıktısı yaklaşık 564 kB / gzip 194 kB). Kaynak penceresi
açılmadan bu modül indirilmez. Paket boyutu iyileştirmesi ileriki işlerden biridir.

Eski TinyMCE vendor dosyaları `C:\htdocs\studio-editor-legacy-20260924` dışında
kaynakta veya artefaktlarda bulunmaz. Eski IndexedDB adının uyumluluk referansı,
temizlik kontrolleri ve araştırma açıklamaları bilinçli olarak korunmuştur.

Çıktı dosyalarının güncel boyut/hash bilgileri `release/manifest.json` içindedir.
Lisans seçimi bekleniyor; npm veya sunucu yayını yapılmadı.
