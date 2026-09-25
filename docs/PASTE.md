# Yapıştırma — beta.9

Düzenle menüsündeki üç seçenek sonraki yapıştırmaları belirler:

- **Biçimi koru:** başlık, liste, tablo, bağlantı ve desteklenen satır içi
  renk/yazı tipi/hizalama stilleri korunur; Office ve geçici pano bilgileri temizlenir.
- **Biçimi temizle:** başlık/liste/tablo/bağlantı yapısı korunur;
  satır içi kalın/italik/renk/font biçimleri kaldırılır.
- **Yalnızca metin:** HTML biçimi ve görseller eklenmez. Ctrl/⌘+Shift+V
  tek seferlik bu modu uygular. Kod (`pre`) içine yapıştırma da metindir.

Vue kullanımında `pasteMode="clean"` veya `v-model:paste-mode="mode"`
seçilebilir. Varsayılan `keep`; diğer değerler `clean` ve `text`.
Menü seçimi editör örneğine aittir; web uygulamasında tercih oturum içidir.
`paste` olayı `{ source, mode, rows, columns, warnings, inserted }` döndürür.
Geçerli HTML tablolarında rows/columns, rowspan/colspan dahil mantıksal
boyutlardır (beta.8). İçerik bu olaya eklenmez. `source` HTML işaretlerine dayanan tahmindir;
doğrulanmış kaynak kimliği değildir. Normal değişim olayları ayrıca çalışır.

## Dönüşümler

- Word `mso-list` paragrafları, sayısal numaralar/madde işaretleri ve iç içe
  seviyeler listeye çevrilir; başlangıç ve madde numaraları korunur.
- Beta.10 basit sınıf/etiket/kimlik/alt öğe CSS seçicilerini, izinli miras
  alınan metin stillerini ve temel cascade önceliğini aktarır. Harf/Romen
  numaraları ve `mso-level-number-format` bilgisi liste dönüşümünde kullanılır.
- Excel/Sheets TSV: tırnak içindeki sekme/satır sonları, çift tırnak kaçışı,
  CRLF ve boş son hücreler korunur. Düzenli dikdörtgen veri yeni tabloya
  dönüşür; düzensiz satırlar metin kalır.
- Excel HTML tabloları ve Google Docs geçici başlık sarmalayıcıları temizlenir.
- Metin+dosya birlikte hazırlanıp tek undo adımında eklenir. Yerel görsel
  yerleri dosya sayısı eşleşirse sırayla doldurulur. Eşleşmezse alt metin
  bırakılır, başarılı dosyalar sona eklenir ve uyarı gösterilir.
- HTML kullanılabilir görsel URL'si içeriyorsa panodaki görsel dosyası tekrar
  eklenmez. Uzak URL tarayıcı tarafından yüklenir; adaptöre ayrıca kopyalanmaz.
- Asenkron yükleme sürerken belge revizyonu/modu değişirse eski seçime
  ekleme yapılmaz. Yüklenen dosyalar kütüphanede bulunabilir.

HTML DOMPurify temizleyicisinden geçer. Pano sınıfları, kimlikleri ve `data-*`
alanları kaldırılır; inceleme kimlikleri kopyalanmaz. HTML+metin toplamı
5 × 1024 × 1024 UTF-16 kod birimini aşamaz. TSV: 1.000 satır, 100 sütun,
10.000 hücre; HTML: toplam 10.000 `td`/`th`. Bunlar UTF-8 bayt sınırları değildir.

## Sınırlar

PowerPaste eşdeğerliği iddia edilmez. Testler temsilî fikstürlerdir; gerçek
Office sürümleri/işletim sistemi panolarıyla belge koleksiyonu testi bekliyor.
Karmaşık CSS seçicileri, harici stil sayfaları, RTF, tüm özel liste
şablonları ve Office çizimleri desteklenmez. Mevcut tablo hücrelerine
matris dağıtımı beta.5'te, birleşik hücre aktarımı beta.8'de eklendi:
[tablo kullanımı ve sınırlar](TABLES.md). Mevcut tabloya aktarımda hedef
hücre stilleri varsayılan olarak temel alınır; beta.9 `tablePasteStyle="source"`
ile `keep` modunda açık kaynak hücre stilleri aktarılabilir. TSV birleşim
bilgisi taşımaz; HTML varsa keep/clean modlarında birleşimler korunur.
Görsel eşleme sıra/sayı sezgisidir;
tarayıcı dosyaları sağlamazsa yerel görsel alınamaz. Sonradan tekrar denenmiş
yükleme belgeye otomatik eklenmez. Pano hata mesajları henüz Türkçedir.

Tarayıcının `text/html` çıktısı işlenir; `StartFragment`/`EndFragment` yorumları
varsa dış kısım atılır. Ham Windows CF_HTML başlığındaki bayt ofsetlerini
ayrıştıran bir işletim sistemi pano okuyucusu değildir. Bu ofsetler UTF-8
baytlarıdır: [Microsoft HTML Clipboard Format](https://learn.microsoft.com/en-us/windows/win32/dataxchg/html-clipboard-format).
