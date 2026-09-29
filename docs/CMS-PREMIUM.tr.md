# CMS kayıt bağlantısı ve gelişmiş editör araçları

Yeni: [düz HTML form, slider ve akordeon oluşturucuları](UI-ELEMENTS.tr.md). Ekle menüsünde bulunur; `features.uiElements` ile açılıp kapatılır.

Studio, mevcut HTML/Vue CMS’inize yerleştirdiğiniz bir **HTML içerik editörüdür**. Kullanıcılar, sayfa adresleri, yetkilendirme, yayın akışı ve SEO alanları sizin CMS’inizde kalır. [Temel kurulum](CMS-INTEGRATION.tr.md) · [Ayrıntılı API sözleşmesi ve Vue/HTML örnekleri](CMS-PREMIUM.md).

[CMS entegrasyon örneğini açın](https://metinweb.github.io/studio-editor/integration/cms.html). Otomatik kayıt, sürüm geçmişi, özellik seçimi ve CSS çıktısını deneyebilirsiniz. Bu örnekte kayıtlar **yalnızca bellektedir**; sayfa yenilenince sıfırlanır. Kalıcı kayıt için kendi sunucunuzun adaptörünü bağlayın.

## Özellikleri açıp kapatma

`toolbar` ve `menubar` görünümü düzenler. Yeni `features` ayarı ise ilgili yerleşik komutları da engeller. Varsayılan olarak bütün özellikler açıktır; kapatmak için `false` kullanın:

```js
editor.setOptions({ features: { media: false, science: false, source: false } })
editor.setOptions({ features: {} }) // yeniden aç
```

Vue: `<StudioEditor :features="{ media: false, source: false }" />`.

| Anahtar          | Kapsam                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------- |
| `formatting`     | Metin/paragraf biçimi, renk, hizalama, biçim kopyalama, kalıcı kalem                    |
| `lists`          | Madde/numara/görev listeleri, liste ayarları ve girinti                                 |
| `tables`         | Tablo ekleme, satır/sütun, hücre biçimi/yapıştırma, birleştirme, sıralama/boyutlandırma |
| `media`          | Medya yükleme/kütüphane, görsel düzenleme, YouTube/Vimeo                                |
| `links`          | Bağlantılar, otomatik bağlantı ve çapalar                                               |
| `review`         | Yorum ve seçili metin önerisi komutları                                                 |
| `history`        | Geri al/yinele ve CMS sürüm geçmişi                                                     |
| `science`        | Matematik, kimya, molekül çizimi                                                        |
| `source`         | Kullanıcının HTML kaynak penceresi                                                      |
| `ai`, `language` | AI yazım ve servis üzerinden dil denetimi                                               |
| `pageEmbed`      | Web sayfası gömme                                                                       |

Mevcut içerik silinmez. Bazı bağlamsal kontroller görünmeye devam etse de kapalı komutlar içerikte değişiklik yapmaz. Bu ayar **sunucu yetkisi veya HTML türü filtresi değildir**: host API, eklenti, kaynak yükleme ve yapıştırma aynı etiketleri içerebilir. Sunucunuz kendi HTML doğrulamasını/yetkilerini uygulamalıdır. Tüm kullanıcı düzenlemesini durdurmak için `readonly`/`disabled` kullanın.

## Otomatik kayıt ve sürüm geçmişi

`bindDocumentSession(editor, { adapter, id, delay, onChange, signal })`, hazır editörü CMS kaydına bağlar. `createHttpDocumentAdapter({ baseUrl, getToken })` HTTP adaptörünü oluşturur. `binding.session` değerini Vue’da `documentSession` prop’una veya HTML’de `editor.setOptions({ documentSession: binding.session })` ile verin.

- Yazma bittiğinde varsayılan 1.500 ms sonra kaydeder; 100–60.000 ms arası ayarlanabilir.
- Kayıt sürerken yazılan yeni metni korur; sonraki istekte dönen yeni sürüm numarasını kullanır.
- 409/412 çakışmasında yerel taslağı korur ve otomatik denemeyi durdurur. Güncel sunucu sürümünü alıp uzlaştırmayı CMS tarafında açıkça yapın; eski sürümle tekrar denemek çakışmayı çözmez.
- `save()`, `retry()`, `pause()`, `resume()`, `dispose()` sağlanır. `dispose()` sunucunun kabul ettiği isteği geri almaz.
- Durumlar: `idle`, `loading`, `dirty`, `saving`, `saved`, `conflict`, `error`.
- Kirli taslakta tarayıcıdan çıkış uyarısı istenir. SPA/router geçişlerini CMS’iniz ayrıca denetlemelidir; tarayıcı uyarıyı göstermeyebilir.
- Sayfa/sunum kapanırken `AbortController.abort()` ve `binding.dispose()` kullanın. İlk yükleme beklerken metin değişmişse eski sunucu içeriği bunun üzerine yazılmaz.

**Araçlar → CMS sürüm geçmişi** kayıtlı sürümleri önizler ve eski HTML’i geri alınabilir bir taslak değişikliği olarak uygular. Sonraki kayıt, mevcut sürüm numarası üzerinden yeni bir sürüm oluşturur; eski kayıtları silmez ve sürüm numarasını geriye götürmez.

Sunucu sözleşmesi (baseUrl altına eklenir):

| İstek                                  | JSON yanıt                                  |
| -------------------------------------- | ------------------------------------------- |
| `GET /documents/:id`                   | `{ id, title, html, blockIds, version }`    |
| `PUT /documents/:id`                   | Yeni string `version` ile kaydedilmiş kayıt |
| `GET /documents/:id/versions`          | `[{ version, title, createdAt? }]`          |
| `GET /documents/:id/versions/:version` | İstenen tarihsel kayıt                      |

PUT, `If-Match: "v4"` gibi beklenen sürümü gönderir. Sunucu sürüm karşılaştırmasını ve kaydı **aynı veritabanı işlemi içinde** yapmalıdır; uyuşmazsa 409/412 döndürmelidir. Kimlik doğrulama, belge yetkileri, CSRF, CORS ve içerik sınırları CMS’inize aittir. Hazır bir CMS sunucusu kurulmaz.

## AI ve dil denetimi

**Araçlar → AI yazım yardımcısı**: yeniden yazma, özetleme, çeviri, kısaltma ve genişletme. **Yazım ve dil bilgisi**: servis önerilerini inceleme ve seçilen düzeltmeyi uygulama.

Önce 1–20.000 karakter seçin. Yalnızca **Çalıştır** ile seçili metin servise gönderilir; pencereyi açmak istek yapmaz. Yanıt incelemeden uygulanmaz. Kod/korumalı öğeler ve inceleme notları korunur. Belge bu sırada değiştiyse eski yanıt uygulanmaz. Çıktı düz metin olarak eklenir ve geri alınabilir. Dil denetiminde bir düzeltmeden sonra seçimi yeniden denetleyin.

`assistanceAdapter` sağlayın veya `createHttpAssistanceAdapter({ baseUrl, label, getToken })` kullanın:

- `POST /ai`: `{ text, language, action, instruction }` → `{ text }`.
- `POST /language`: `{ text, language }` → `{ issues: [{ offset, length, message, replacements: [] }] }`.
- Konumlar gönderilen metnin **JavaScript UTF-16 birimleriyle** belirtilir; emoji nedeniyle karakter sayısıyla farklı olabilir.
- En fazla 200 sorun, sorun başına 10 düzeltme ve 100.000 karakter AI yanıtı kabul edilir.
- İptal/kapatma/özellik kapatma sinyali keser; geç yanıtlar uygulanmaz. Pencerenin zaman aşımı 120 saniyedir.

AI/gramer hizmeti, abonelik veya gizli anahtar pakete dahil değildir. Uç noktaları kendi sunucunuzda seçtiğiniz sağlayıcılara bağlayın. Sağlayıcı gizli anahtarını tarayıcıya koymayın. Yayınlanan demoda servis bağlı olmadığı açıkça gösterilir.

## Site CSS’si, önizleme ve çıktı

**Görünüm → İçerik stili ayarları** üzerinden CSS adreslerine ek olarak `article prose` gibi body sınıfları ayarlanabilir. `bodyClass`, en fazla 20 basit sınıf adını kabul eder; geçersiz/tekrarlı adları çıkarır. Vue’da `v-model:body-class`, HTML’de `onBodyClassChange` ile izleyin. Sınıflar yalnızca editörün içerik alanına ve önizlemeye uygulanır. `allowContentCss: false` kullanıcı ayarını kapatır; host yine stil sağlayabilir.

**Belge önizlemesi**: masaüstü, 768 px tablet, 390 px telefon ve 1024/844 px yatay ekran. CSS media query’leri bu boyutlara göre çalışır. Bu bir cihaz emülatörü değildir.

`editor.getInlineHTML()`, mevcut görünümdeki desteklenen hesaplanmış metin, kenarlık, boşluk ve liste stillerini ayrı, temizlenmiş HTML çıktısına yazar; belgeyi değiştirmez. Dinamik durumlar, pseudo-elementler, bütün düzen sistemleri, font/varlık dosyaları veya e-posta istemcilerinde birebir görünüm garantisi kapsamda değildir.

## Web sayfası gömme

**Ekle → Web sayfası göm** veya `openPageEmbed()`: HTTPS adresi, erişilebilir başlık ve 200–1.200 px yükseklik. Açıklamaya tıklayarak düzenleyin/kaldırın. Kaydedilen şekil JSON modelinde taşınabilir; görüntüleyici `sandbox=""`, lazy loading ve no-referrer ile çerçeveyi yeniden oluşturur. Keyfi iframe HTML’i, script ve form izinleri kabul edilmez. Sitelerin CSP/X-Frame-Options engeli aşılamaz; bağlantı kullanılabilir kalır. Script gerektiren sayfalar bu kısıtlı görüntüleyicide çalışmayabilir.

## Açık kalan sınırlar

Bu güncelleme bütün TinyMCE premium özellikleriyle eşdeğerlik iddiası taşımaz. Her değişikliği otomatik izleyen tam Track Changes, üretim düzeyinde çok kullanıcılı yapısal uzlaştırma/canlı imleçler, birebir Office dönüşümü, sunucuda PDF servisi, tam erişilebilirlik denetimi ve yönetilen medya CDN’i henüz sağlanmıyor. Mevcut seçili metin önerileri, deneysel işbirliği, DOCX dönüşümü, tarayıcı PDF’i ve medya adaptörleri kullanılabilir. [Güncel karşılaştırma](TINYMCE-COMPARISON.md).
