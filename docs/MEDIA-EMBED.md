# Zengin medya gömme

YouTube ve Vimeo videoları web uygulamasında ve Vue bileşeninde desteklenir.

## Kullanım

- **Ekle → Bağlantıdan medya ekle** veya araç çubuğundaki film simgesi: bağlantı, açıklama, yüzde genişlik ve hizalama.
- **Önizlemeyi aç**: etkileşimli oynatıcı. Editör içindeki oyuncu görünümü seçim ve düzenlemeye ayrılmıştır; oynatmak için özellikler penceresindeki önizlemeyi kullanın.
- Desteklenen tek bir URL'yi normal metne yapıştırmak otomatik medya bloğu oluşturur. Aynı URL metnini taşıyan tek bağlantı HTML'i de desteklenir. Seçili metne yapıştırma mevcut bağlantılama davranışını korur. Düz metin yapıştırma, kod ve tablo hücresine yapıştırma otomatik gömme yapmaz.
- Bloğa tıklayın: açıklama/URL düzenleme, sola/ortaya/sağa hizalama, %50/%75/%100 genişlik, silme. Sağ tık menüsünden de düzenlenebilir ve silinebilir.
- Sağ alt tutamağı sürükleyerek genişliği değiştirin. Escape iptal eder; tutamak odaktayken sağ/sol ok %5 değiştirir. En-boy oranı 16:9, genişlik %25–100 aralığındadır.
- Seçili blokta Delete/Backspace siler; Enter/ok tuşlarıyla çevresindeki metne geçilir. Düzenlemeler geri alınabilir; kaydet/aç ve HTML kopyala/yapıştır ile korunur.

## Desteklenen adresler

YouTube: `youtube.com/watch?v=…`, `youtu.be/…`, `/shorts/…`, `/live/…`, `/embed/…`; mobil alan adı ve `youtube-nocookie.com/embed/…`. Tek video desteklenir; oynatma listesi/kanal değildir. `t=90`, `t=1m30s`, `start=90` başlangıç zamanı korunur (en fazla 24 saat).

Vimeo: `vimeo.com/123456789`, `vimeo.com/123456789/5e2d1c1e6d` ve `player.vimeo.com/video/123456789?h=5e2d1c1e6d`. Gizli video hash'i korunur. Etkinlik/vitrin/kanal bağlantıları bu sürümde yoktur.

Adresler HTTPS'e ve kanonik sağlayıcı biçimine dönüştürülür. Takip parametreleri, autoplay ve keyfi oynatıcı seçenekleri taşınmaz. Başlık için sağlayıcı API çağrısı yapılmaz; açıklamayı kullanıcı yazar. Kaynak bağlantısı her zaman görünür.

## Veri ve entegrasyon

Kaydedilen HTML, `figure[data-studio-embed]` içinde kanonik bağlantıyı, genişliği, hizalamayı ve açıklamayı saklar. `cleanHtml()` önce kullanıcıdan gelen iframe/script kodlarını temizler; yalnızca doğrulanmış sağlayıcı adresinden sabit izinlere sahip iframe üretir. Genel iframe veya oEmbed proxy desteği açılmamıştır.

Şema 2 modeli, medya bloğunu taşınabilir `figure`/bağlantı olarak saklar. iframe ve `contenteditable` modele girmez; model yeniden editöre alındığında oynatıcı oluşturulur. Bu sayede model doğrulaması ve Yjs aktarımı keyfi iframe kabul etmez. Açıklama normal metin biçimlendirme/bul-değiştir işlemlerine dahil edilmez; medya özelliklerinden düzenlenir.

Vue uygulamaları mevcut `insertHTML()` API'siyle şu anlamsal gösterimi de ekleyebilir:

```html
<figure
  data-studio-embed="https://www.youtube.com/watch?v=M7lc1UVf-VE"
  data-studio-embed-width="75"
  data-studio-embed-align="center"
  data-studio-embed-caption="Tanıtım videosu"
></figure>
```

HTML yayını için mevcut `getPublicHTML()` / `renderDocument()` kullanılır. CSS'i ayrı sunan tüketici `documentCss` içindeki medya stillerini de kullanmalıdır. Uygulamanın CSP'si varsa `frame-src` için `https://www.youtube-nocookie.com` ve `https://player.vimeo.com` izinleri gerekir. Önizleme sağlayıcı sunucularına bağlantı kurar; videonun gizlilik, alan adı veya gömme izinleri oynatmayı engelleyebilir.

PDF/yazdırmada oynatıcı gizlenir, açıklama/kaynak bağlantısı kalır. DOCX bir video oynatıcı taşımaz. Video dosyasının kendisi arşive indirilmez; çalışma alanı yedeği medya bağlantısını saklar.

## Doğrulama

- `tests/media-embed.spec.js`: ekleme, URL doğrulama, önizleme, kalıcılık, undo/redo, bağlam menüsü, boyut/hizalama, otomatik/düz yapıştırma, kötü amaçlı iframe temizleme, kopyalama, klavye, mobil görünüm ve sürükleme iptali.
- `scripts/tests/media-embed.test.mjs`: URL ayrıştırma, alan adı/şema sınırları, zaman/hash ve HTML kaçışları.
- `node scripts/check-media-embed.mjs` (önce `npm run build:library`): derlenmiş Vue bileşeni, şema 2, ortak belge aktarımı, blok kimliği ve readonly.
- Tarayıcı testlerinde sağlayıcı yanıtı sabit bir test oynatıcısıyla değiştirilir. Bu testler gerçek videoların erişilebilirliğini veya kesintisiz oynatılmasını garanti etmez.
- `docs/screenshots/media-embed/`: masaüstü/mobil inceleme görüntüleri; test oynatıcısı gerçek YouTube içeriği değildir.

Web uygulaması ve kütüphane derlemeleri güncellendi. Önceden oluşturulmuş beta.10 `release/` arşivleri bu değişiklik için yeniden paketlenmedi.

Sağlayıcı referansları: [YouTube oynatıcı parametreleri](https://developers.google.com/youtube/player_parameters), [Vimeo gizli video hash'i](https://help.vimeo.com/hc/en-us/articles/12426470858001-Embedded-player-displays-This-video-does-not-exist-message).
