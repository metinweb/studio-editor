# Studio Editor: araştırma ve ürün yol haritası

Araştırma tarihi: **24 Eylül 2026**. Ürün belgeleri ve mevcut kaynak kodu birlikte
incelendi. Bu dosyadaki "öneri" ve "hedef" ifadeleri henüz uygulanmamış işleri
gösterir. Rakiplerin özellikleri bizim editörde bulunduğu anlamına gelmez.

## Uygulama durumu — 0.1.0-beta.10

Beta.10 ile aşağıdaki araştırma listesinin 12 başlığında uygulama yapıldı.
Güncel durum için [uygulama kaydı](IMPLEMENTATION-PROGRESS.md), kullanım ve
API için [Beta.10](BETA10.md) esas alınmalıdır. Aşağıdaki beta.2–9 açıklamaları
ve rakip karşılaştırma tablosu tarihsel araştırma kaydıdır; bugünkü eksik listesi değildir.

Tam yedek, kalıcı sürüm geçmişi, yazım kısayolları/blok taşıma, şema 2 API,
Office sınıf/miras stilleri, RTL resize, WebP/Worker, medya sunucusu, eklenti
ve belge adaptörü, metin önerileri, deneysel iş birliği ve PDF/DOCX eklendi.
Tam otomatik değişiklik izleme, güvenilir eş zamanlı yapısal düzenleme,
gerçek Office/cihaz/ekran okuyucu kabul testleri hâlâ açık konulardır.

Beta.9 hedef veya kaynak hücre biçimi seçimi, açık hücre stillerinin aktarımı,
Vue prop/v-model sözleşmesi ve tek undo ekler. Kaynak CSS sınıfları ve miras
alınan stiller çözülmez; gerçek Office pano koleksiyonu hâlâ doğrulanmalıdır.

Beta.8 birleşik HTML matrisini mevcut tabloya aktarır; normal matrisle kapsanan
birleşik hedefi ayırır. Kısmi hücre, bölüm sınırı, boyut ve taşma kontrolleri;
mantıksal metaveri, tek undo ve paket doğrulamaları eklenmiştir.

Beta.7 toplu hücre renkleri, hizalama, iç boşluk ve kenarlık biçimini ekler.
Değişen alanlara uygulama, karışık değerler, önizleme, iptal ve tek undo;
Türkçe/İngilizce pencere, revizyon ve readonly koruması tamamlandı.

Beta.6 seçili dikdörtgeni/yatay/dikey hücreleri birleştirme ve ayırmayı;
birleşik tablolara span uyumlu satır/sütun ekleme-silmeyi ekler. Farklı tablo
bölümleri korunur, içerik kalan birleşik hücreye taşınır, her işlem geri alınır.

Beta.5 tablo koordinat matrisi, çoklu hücre seçimi, sütun sınırından resize,
HTML/TSV kopyala/kes ve mevcut hücrelere matris yapıştırmayı ekler.
[Kullanım ve kapsam sınırları](TABLES.md). RTL ve dokunmatik doğrulama bekliyor.

Beta.4: Word listeleri, Excel/Sheets TSV, Google Docs temizliği, üç yapıştırma
modu ve metin+görsel için tek undo eklendi. [Kapsam ve sınırlar](PASTE.md).
Üretim Vue bileşeniyle büyük belge Chromium ölçümü çalıştırıldı:
[yöntem ve sonuçlar](BROWSER-PERFORMANCE.md). Bunlar temsilî fikstürlerdir;
tam Office uyumluluğu veya rakiplerden hızlı olma iddiası değildir.

Entegrasyon aşaması eklendi: `readonly`, `disabled`, `placeholder`, araç grubu
ve menü seçimi, örneğe özel `locale`/`messages`. Çekirdek arayüz Türkçe/İngilizce;
gelişmiş panellerin çevirisi ve RTL bekliyor. Modlar çalışma sırasında belgeyi
yeniden kurmadan değiştirilebilir. Proje `C:\htdocs\studio` konumunda devam ediyor.

İlk mimari aşama uygulandı: sürümlü yerel işlem olayları, tersine çevrilebilir
HTML ve blok kimliği farklarıyla geçmiş, HTML dışında oturum içi blok kimlikleri,
metin konumu eşleme yardımcıları ve editör örneğine özel medya adaptörü.
Yükleme ilerlemesi, iptal, hata/tekrar deneme ve unmount sonrası geç yanıtların
atılması eklendi. Sunucu uçları için tüketici örneği ve paket testleri mevcut.

[Mimari sözleşme ve sınırlar](ARCHITECTURE.md),
[doğrulama kaydı](VERIFICATION.md), [ölçüm verileri](history-benchmark.json).
Bu aşama ortak düzenlemeyi veya aşağıdaki tüm ürün özelliklerini tamamlamaz.

Beta.9 sonunda belirlenen uygulama sırası (beta.10 durumunu üstteki kayıttan izleyin):

1. Tamamlanan entegrasyon sözleşmesini genişletme: gelişmiş panellerin çevirileri, RTL ve dil/klavye kontrolleri.
2. Ölçümleri tam web uygulaması, farklı cihazlar ve tarayıcılara genişletme; ölçülen darboğazları azaltma.
3. Tablo geliştirmesinin devamı: RTL ve dokunmatik kullanım; gerçek Office pano koleksiyonu, sınıf ve miras alınan stil dönüşümleri.
4. DOM'dan bağımsız şemalı belge modeli, anlamsal işlemler ve kalıcı kimlik prototipi.
5. Şema sürümlü yedekleme ve kalıcı sürümler; ardından değişiklik izleme/CRDT.

## Ana karar

İlk hedef, güvenilir biçimde başka uygulamalara eklenebilen bir **HTML içerik
editörü** olmalı. Belge iş akışı, ortak düzenleme ve AI sonradan eklenmeli.
Yeni düğmelerden önce seçim kararlılığı, yapıştırma kalitesi, büyük belgelerde
gecikme, veri koruma ve entegrasyon sözleşmesi çözülmeli.

Kendi DOM/Selection/Range motorumuzu koruyabiliriz. Ancak track changes ve eşzamanlı
düzenleme için yerel HTML farkı geçmişi yeterli bir temel değil.
İlk işlem/kimlik/seçim prototipi beta.2'de eklendi. Şimdi anlamsal belge modeli,
kalıcı kimlikler ve yapısal seçim eşlemesi gerekir. Lexical'in DOM dışında belge durumu tutması ve
Yjs'in editör bağlayıcısı gerektirmesi bu ayrımın iki somut örneğidir.
[Lexical belge durumu](https://lexical.dev/docs/concepts/editor-state),
[Yjs editör entegrasyonu](https://docs.yjs.dev/getting-started/a-collaborative-editor).

## Rakiplerden çıkan öncelikler

| Alan                                  | Belgelerde görülen değer                                                                          | Bizdeki durum                                                                                          | Önerilen sonraki adım                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Word / Excel / Google Docs yapıştırma | PowerPaste kaynak uygulamaya özgü temizleme ve biçim aktarımı sunuyor.                            | Beta.4 Office listeleri, TSV ve yapıştırma modları; beta.5 hücre matrisine aktarım.                    | Gerçek Office pano koleksiyonu, özel listeler, sınıf ve miras alınan stil dönüşümü.                                          |
| Tablo düzenleme                       | TinyMCE tablo arayüzü özellikler, bağlam menüleri ve hızlı araç çubuklarını birlikte sunuyor.     | Çoklu seçim, sütun resize, matris aktarımı, yatay/dikey birleştirme ve span uyumlu yapı işlemleri var. | Sınıf/miras stil dönüşümü, RTL ve gerçek dokunmatik doğrulama.                                                               |
| Sürüm geçmişi                         | TinyMCE önceki sürümleri karşılaştırma ve geri getirme arayüzü sunuyor.                           | Yalnızca oturum içi undo/redo var.                                                                     | Kalıcı sürümler, yazar/zaman, fark görünümü, geri yüklemeden önce yeni sürüm kaydı.                                          |
| Değişiklik izleme                     | CKEditor önerileri kabul/ret iş akışına bağlıyor.                                                 | Yorum var; öneri/değişiklik izleme yok.                                                                | İşlem modeli sonrası ekleme/silme/biçim önerileri; yorumlardan ayrı depolama.                                                |
| Ortak düzenleme                       | Tiptap iş birliği, varlık göstergeleri, sürüm geçmişi ve yorumları bir araya getiriyor.           | Tek tarayıcıda yerel belgeler.                                                                         | Yetkilendirme + belge servisi + CRDT bağlayıcısı; çevrimdışı tekrar bağlanma ve kullanıcıya ait undo.                        |
| Word/PDF ve sayfalama                 | CKEditor sayfa sınırlarını tarayıcıda gösterirken dışa aktarımı dönüştürme servisleriyle yapıyor. | HTML aktarımı var.                                                                                     | Önce yazdırma stili ve gerçek PDF çıktı testi; sonra DOCX dönüştürme adaptörü.                                               |
| Erişilebilirlik                       | TinyMCE a11ychecker çeşitli içerik sorunlarını denetliyor.                                        | Alt metin, bağlantı adı, tablo/başlık denetimleri var.                                                 | Kontrast, tablo başlık ilişkileri, klavye ve ekran okuyucu testleri. Otomatik testten uygunluk belgesi sonucu çıkarılmamalı. |

Kaynaklar:
[PowerPaste](https://www.tiny.cloud/docs/tinymce/latest/introduction-to-powerpaste/),
[TinyMCE tablolar](https://www.tiny.cloud/docs/tinymce/latest/table/),
[gelişmiş tablolar](https://www.tiny.cloud/docs/tinymce/latest/advtable/),
[sürüm geçmişi](https://www.tiny.cloud/docs/tinymce/latest/revisionhistory/),
[CKEditor değişiklik izleme](https://ckeditor.com/docs/ckeditor5/latest/features/collaboration/track-changes/track-changes.html),
[Tiptap iş birliği](https://tiptap.dev/docs/collaboration/getting-started/overview),
[CKEditor sayfalama](https://ckeditor.com/docs/ckeditor5/latest/features/pagination/pagination.html),
[TinyMCE erişilebilirlik denetimi](https://www.tiny.cloud/docs/tinymce/latest/a11ychecker/).

## Kaynak kodunda gördüğüm yayın engelleri

1. **Büyük belge maliyeti:** beta.2 geçmişi tam HTML kopyaları yerine farklar
   tutar; boyut hesabı artımlıdır. Kelime/karakter sayımı aynı metin sonucunu
   paylaşır. Motor yine her commit'te HTML ve blok metinlerini okur. Saf geçmiş
   benchmark'ına ek olarak beta.4'te Chromium giriş/çizim fırsatı ve heap ölçümleri eklendi.
   Başka editörlerden daha hızlı olduğumuza dair karşılaştırma yok.
2. **Medya/veri katmanı:** beta.2 özel upload/list/update/remove adaptörü,
   ilerleme, iptal ve tekrar deneme sağlar. Backend, kimlik doğrulama, dosya
   inceleme, kalıcı asset referansı ve imzalı URL yenileme henüz yoktur.
3. **Model sınırları:** motor DOM'u düzenliyor; yerel işlem HTML farkıdır.
   Kimlikler oturum içi, seçim eşlemesi blok içi metin düzeyindedir. Uzaktan
   gelen yapısal değişiklikler ve öneri aralıkları için anlamsal model gerekir.
4. **Yapıştırma:** beta.4 karma metin+görsel, Office/TSV fikstürleri, modlar ve
   sınırlar ekler. Gerçek Office sürümleri/işletim sistemi panoları, özel liste
   şablonları hâlâ doğrulanmalı/geliştirilmeli. Beta.5 hücre matrisine aktarımı ekler.
5. **Entegrasyon yüzeyi:** bu çalışmada Vue bileşeni, tipler, yerel paket ve CSS
   sınırlandırması eklendi. Beta.3 modlar, toolbar/menü yapılandırması ve çekirdek
   dil sözleşmesini ekler; tam dil paketleri ve kararlı komut/eklenti API'si bekliyor.
6. **İçerik yedekleme:** HTML dışa aktarımı belge görünümünü korur ama yorumları,
   tüm medya kütüphanesini ve şablonları tam yedeklemez. Taşınabilir çalışma
   alanı arşivi + sürümlü şema + geri yükleme doğrulaması gerekir.

## Önerilen iş sırası ve kabul ölçütleri

### A — Yayın temeli: ilk öncelik

- **Lisans ve kimlik:** açık kaynak lisansını birlikte seçmek, LICENSE metni,
  paket adı/scope, depo URL'si, güvenlik bildirim kanalı ve sürüm politikasını
  tamamlamak. Beta paketine kararlı 1.0 etiketi vermemek.
- **Entegrasyon:** `readonly`, `disabled`, `placeholder`, toolbar/menü seçimi,
  çekirdek `locale`/`messages` beta.3'te eklendi. Kalan: tam çeviri, belge depolama adaptörleri. Medya adaptörü ve yükleme/hata olayları
  beta.2'de eklendi; gerçek sağlayıcıyla doğrulanmalı. Her API için
  bir tüketici örneği ve geriye uyumluluk testi.
- **Performans:** 1.000/10.000 paragraf, 100×20 tablo, 50 görsel senaryoları;
  beta.4 Chromium benchmark'ında girişten iki çizim karesine p50/p95, programatik
  seçim, açılış, undo ve heap ölçüldü; fiziksel klavye/ekran gecikmesi değildir.
  Başlangıç hedefi referans cihazda normal belgede p95 <50 ms; bu ölçülmüş
  sonuç değildir. Ağır işlemler ertelenmeli, seçim değişiminde gereksiz tam
  tarama azaltılmalı, medya geçmişten ayrılmalı.
- **Klavye ve IME:** gerçek Android/iOS, Türkçe klavye, emoji/surrogate pair,
  Japonca/Çince kompozisyon, RTL seçimi ve ekran okuyucu oturumları.
- **Güvenlik:** yapıştırma, kaynak görünümü, SVG/MathML/CSS/URL saldırı
  fikstürleri; sunucu tarafı içerik doğrulaması; upload dosya türü ve boyut
  denetimi. `npm audit` tek başına uygulama güvenliği kanıtı değildir.

### B — Günlük kullanımda en fazla fark yaratan özellikler

| İş                     | Kabul ölçütü                                                                                                                      | Göreli kapsam |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Akıllı yapıştırma      | Beta.4 temsilî fikstürlerle eklendi. Kalan: gerçek Office pano koleksiyonu ve özel listeler; beta.5 hücre matrisini ekler.        | Büyük         |
| Tablo 2.0              | Beta.5–9: çoklu seçim, resize, birleşik matris aktarımı, yapı işlemleri ve toplu biçim. Kalan: sınıf/miras stilleri, RTL/dokunma. | Büyük         |
| Sunucu medya adaptörü  | İstemci sözleşmesi beta.2'de eklendi. Kalan: gerçek backend, yetkili URL ve belgede kalıcı asset referansı.                       | Orta–büyük    |
| Görsel iş akışı        | WebP çıktı, kalite ayarı, sıkıştırma, EXIF yönü, Worker tabanlı büyük dosya işleme.                                               | Orta          |
| Tam yedek/geri yükleme | Belgeler+yorumlar+medya+şablonlar; şema sürümü; hatalı arşivi uygulamadan önce reddetme.                                          | Orta          |
| Kalıcı sürüm geçmişi   | Sürüm listesi/fark, güvenli geri yükleme, kota politikası; yenilemeden sonra korunma.                                             | Orta–büyük    |
| Daha hızlı yazım       | `/` komut menüsü, Markdown kısayolları, bağlantı yapıştırınca linke dönüştürme, sürüklenebilir bloklar.                           | Orta          |
| Erişilebilirlik/dil    | En az Türkçe+İngilizce, RTL; tüm menüler klavyeyle kullanılabilir, odak görünür.                                                  | Orta          |

Kapsamlar takvim vaadi değildir. Özellikle tablo ve Office yapıştırma işleri
ayrı prototip ve gerçek belge koleksiyonu gerektirir.

### C — Ekip ve belge iş akışı

Kalıcı yorum kimlikleri, kullanıcı/yetki modeli, @mention bildirimi, değişiklik
izleme, kabul/ret, inceleme durumu. Sonrasında gerçek zamanlı ortak düzenleme.
İki kullanıcının aynı hücrede düzenlemesi, çevrimdışı çatışma, kullanıcı silinmesi,
izin iptali ve yerel undo testleri tamamlanmadan iş birliği "hazır" sayılmamalı.
Yjs burada değerlendirilebilir; mevcut motorun yerine geçmez, ona bağlanır.

### D — İsteğe bağlı servisler

- DOCX içe/dışa aktarma ve PDF servisleri: font gömme, satır/sayfa kırılması,
  tablo taşması, başlık/altbilgi ve çıktı görsel karşılaştırması.
- AI: seçili metni yeniden yaz, çevir, özetle; değişikliği önizle ve kabul et.
  Sağlayıcı adaptörü, sunucuda anahtar, iptal/streaming, maliyet sınırı ve
  kullanıcı başlatmadan içerik göndermeme. AI eklemek paketlemeye engel olmamalı.
- React/Web Component sarmalayıcıları ve CDN dağıtımı: önce Vue API'si kararlı
  olmalı; aynı motor davranışını tekrar uygulayan ayrı editörler üretilmemeli.

## Bu çalışmada tamamlanan paketleme temeli

- Kullanılmayan TinyMCE dağıtımı proje dışına taşındı. Bağımsızlık regresyon testi
  ve eski IndexedDB adı açıklaması korunuyor; bunlar vendor dosyaları değildir.
- Web dağıtımı + ESM Vue bileşeni + TypeScript tanımları + kaynak/medya pencereleri.
- Vue/Pinia eş bağımlılık; kütüphane stilleri kapsamlı; DOMPurify örneği izole;
  birden fazla editör için diyalog başlık kimlikleri benzersiz.
- Yerel `.zip` / `.tgz`, dosya hash'leri, bağımlılık envanteri, gerçek lisans
  metinleri, ayrı tüketicide kurulum/derleme/TypeScript/tarayıcı testleri.
- Lisans seçilmediği için `private: true`, `UNLICENSED` ve açık durum belgesi.
  Gerçek yayın yapılmadı.

Paketleme tasarımı için:
[Vite library mode](https://vite.dev/guide/build.html#library-mode),
[Vue v-model sözleşmesi](https://vuejs.org/guide/components/v-model.html),
[npm package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/),
[npm pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/).

# Beta.10 durumu

Sıralı geliştirme ilerlemesi [IMPLEMENTATION-PROGRESS.md](IMPLEMENTATION-PROGRESS.md), yeni kullanım/API ve açık sınırlar [BETA10.md](BETA10.md) içinde tutulur. Aşağıdaki beta.2–9 değerlendirmeleri tarihsel bağlamdır; beta.10 ilerlemesi bu üst bağlantılarda güncellenir.
