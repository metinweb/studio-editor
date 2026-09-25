# Belge yönetimi

25 Eylül 2026: bağımsız Studio uygulamasına favoriler, etiketler, belge içeriğinde arama ve sıralama eklendi.

- **Favoriler:** Belge başlığının altındaki yıldızla favoriye ekleyin veya çıkarın. Sol menüdeki Favoriler düğmesi yalnız favorileri gösterir; tekrar tıklamak filtreyi kaldırır.
- **Etiketler:** Başlığın altındaki Etiket ekle düğmesiyle açılır. Enter veya Ekle ile etiket eklenir; etiketin yanındaki çarpı kaldırır. Belge başına en fazla 10 etiket, etiket başına 32 karakter desteklenir. Türkçe büyük/küçük harf farkıyla yinelenen etiketler eklenmez. Değişiklikler otomatik kaydedilir.
- **Arama:** Sol arama alanı başlık, etiket ve belge metnini birlikte tarar. Boşlukla ayrılan sözcüklerin tümü eşleşmelidir; sözcükler farklı alanlarda bulunabilir. Türkçe `İ/i` ve `I/ı` eşleşmesi desteklenir. HTML öznitelikleri, medya dosyalarının içeriği ve yorum metaverisi aranmaz.
- **Filtreleme:** Etiket filtresi arama ve favorilerle birlikte çalışır. Temizle, bütün filtreleri kaldırır. Son kullanımı silinen etiketin filtresi otomatik kaldırılır. Filtre sonucu boşalsa da açık belge düzenlenebilir.
- **Sıralama:** Son düzenlenen, önce eski düzenlenen, başlık A–Z ve Z–A. Başlıklar Türkçe ve doğal sayı sırasıyla karşılaştırılır (Belge 2, Belge 10'dan önce gelir).

Yeni belge oluşturmak ve HTML içe aktarmak filtreleri temizler. Sıralama korunur. Arama, filtre ve sıralama seçimleri oturuma aittir; sayfa yenilenince varsayılana döner.

Favoriler ve etiketler belgenin IndexedDB kaydında ve tam çalışma alanı yedeğinde korunur. Eski yedeklerde bu alanlar isteğe bağlıdır; bulunmazsa boş etiket ve favori olmayan belge olarak açılır. Belgeyi çoğaltma etiketleri taşır; yeni kopya favori olarak işaretlenmez. İçerik sürümünü geri yüklemek güncel favori ve etiketleri değiştirmez. HTML/DOCX belge çıktısına çalışma alanı etiketleri ve favori bilgisi eklenmez.

Aramada HTML'den çıkarılan metin belge başına önbelleğe alınır; yalnız içerik değişince tekrar ayrıştırılır. Bu araçlar bağımsız uygulamanın belge listesine aittir; Vue editör bileşenine yeni prop eklenmemiştir.

## Doğrulama

Sonuç: **45/45 birim testi** ve Chromium, Firefox, WebKit üzerinde **54/54 ilgili tarayıcı senaryosu** geçti. Küçük ekran düzenlemesinden sonra altı mobil senaryo yeniden geçti. Üretim web derlemesi güncel. Masaüstü ve 360 × 667 telefon yerleşimleri [ekran görüntülerinden](screenshots/document-library) incelendi.

`scripts/tests/document-library.test.mjs`: Türkçe eşleşme, birleşik filtreler, doğal sıralama, canlı değişiklikler ve arama önbelleği.

`scripts/tests/archive.test.mjs`: eski yedek uyumluluğu ve yeni metaverinin tür/boyut denetimi.

`tests/document-library.spec.js`: favori/etiket kalıcılığı, yinelenen etiket, kaldırma, boş sonuç, birleşik arama, sıralama, yeni belge ve mobil kullanım.

`tests/workspace-data.spec.js`: favori ve etiketlerin tam yedekten geri yüklenip tekrar dışa aktarılması.
