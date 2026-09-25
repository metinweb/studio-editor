# Sıralı geliştirme çalışması

24 Eylül 2026'daki geliştirme sırası aşağıdadır. 25 Eylül 2026'da proje sahibi MIT lisansını ve `metinweb/studio-editor` herkese açık GitHub deposu ile GitHub Pages yayımını seçti. npm yayımı bu kapsamda değildir.

1. Performans: ilk iyileştirme uygulandı; tam çalışma alanı üç tarayıcı ölçümü `workspace-performance-before.json` / `workspace-performance-after.json`. Hücre ölçümleri yaklaşık %99 azaldı; WebKit büyük belge seçim p95 225→47 ms. Fiziksel gecikme değildir.
2. Tam yedek: uygulandı ve üç tarayıcıda doğrulandı; şema/checksum, atomik ekleme, önce doğrulama, mevcut belgeler korunur. Arşiv sıkıştırılmamış JSON, 100 MB sınırı vardır; checksum imza değildir.
3. Kalıcı sürümler: uygulandı ve üç tarayıcıda doğrulandı; 30 saniye örnekleme, 30 sürüm / yaklaşık 20 MB, elle kayıt, kelime farkı, geri yükleme. Son sürüm boyutundan bağımsız korunur.
4. Yazım: slash menüsü, Markdown blok kısayolları, yazılan/yapıştırılan HTTP bağlantıları üç tarayıcıda doğrulandı. Blok sürükleme, hedef çizgisi, klavye ile taşıma ve tek undo eklendi.
5. Model: JSON şema 2, saf metin/blok/öznitelik işlemleri, revizyon denetimi ve kalıcı üst blok kimlikleri eklendi. HTML API şema 1 korundu. DOM hâlâ tarayıcı düzenleme katmanıdır; tüm düzenleme komutları anlamsal işlem üretmiyor. Gerçek npm tüketicisinde üç tarayıcı köprüsü ve undo doğrulandı.
6. Office: sınıf ve miras stilleri, temel cascade, harf/Romen listeleri üç tarayıcıda geçti. Basit seçiciler desteklenir, karmaşık kurallar/harici CSS alınmaz. Gerçek Office/işletim sistemi pano koleksiyonu ayrıca gerekli.
7. Dil/RTL: dört gelişmiş panel çeviri kapsamı genişledi; direction prop ve RTL sütun resize eklendi, resize üç tarayıcıda geçti. Dinamik bazı bildirimler/şablon içerikleri Türkçe kalabilir. Gerçek mobil/ekran okuyucu oturumları henüz yapılmadı.
8. Medya: Worker, WebP, kalite ayarı ve kalıcı asset kimliği eklendi; görsel piksel/resize/undo testleri üç tarayıcıda geçti. Süreli URL yenileme API'si, HTTP adaptörü ve disk tabanlı kimlik doğrulamalı örnek sunucu eklendi. Sunucu bir referans uygulamadır; çok kiracılı üretim hizmeti değildir. Gerçek hesap/depolama kurulmadı.
9. Entegrasyon: isim alanlı komut/eklenti kaydı, disposer, readonly denetimi ve iyimser kilitleme sözleşmeli belge oturumu eklendi. Çakışmada yerel değişiklikler korunur. Gerçek sağlayıcı adaptörü uygulayıcıya aittir.
10. İnceleme: seçili metne öneri, kabul/ret, güncelliğini yitirmiş öneriyi engelleme, kalıcılık ve undo üç tarayıcıda geçti. Bu, bütün yazım/biçim/yapı işlemlerini otomatik izleyen tam Track Changes değildir.
11. İş birliği: isteğe bağlı Yjs çekirdeği, ikili güncelleme, çevrimdışı metin birleştirme, yerel undo ve IndexedDB köprüsü eklendi. Canlı editör binding'i üç tarayıcıda; oda izinleri, editör/izleyici, yetki iptali, presence, HTTP yeniden bağlanma ve disk kalıcılığı gerçek yerel referans sunucuyla doğrulandı. Yapısal eş zamanlı düzenleme ve canlı imleçler tamamlanmadı; mod deneysel kalır.
12. Çıktı: sayfa boyutu/yön/kenar boşluğu, üst/altbilgi, tarayıcı PDF yazdırma ve gerçek OOXML DOCX dışa aktarımı uygulandı; üç tarayıcıda OOXML/birleşik tablo/liste/çoklu görsel kontrolleri geçti. Masaüstü/dar ekran önizleme incelendi, Chromium ile PDF örneği üretildi. DOCX içe aktarımı, tam Word görünüm eşitliği ve gerçek Word/LibreOffice görsel doğrulaması henüz yoktur.

Proje MIT lisanslıdır. Depo `metinweb/studio-editor`, web barındırma GitHub Pages'tir. npm adı/scope sahipliği ayrıca doğrulanmalıdır; `private: true` yanlışlıkla npm yayımını önlemek için korunur.

## CKEditor farklarından devam — 25 Eylül 2026

Kullanıcının yeni beş aşamalı sırasındaki günlük kullanım bölümü uygulandı: canlı başlık gezgini, görev listeleri, `@` bahsetme, adlandırılmış stiller ve eklenti komutlarını da alan slash menüsü. Kullanım, saklama sözleşmesi ve doğrulama: [DAILY-WRITING.md](DAILY-WRITING.md).

Sonraki aşama ortak belge işlemleridir. Belge iş akışı, dosya uyumluluğu ve isteğe bağlı hizmetler sırada kalır; bu başlıklar tamamlanmış değildir.
