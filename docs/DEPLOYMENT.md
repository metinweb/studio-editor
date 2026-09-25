# Studio Editor web dağıtımı

Bu çıktı bağımsız, statik web uygulamasıdır. Sunucuda Node.js gerektirmez.
Proje MIT lisansıyla açık kaynaktır. Tanıtım ve demo için [GitHub Pages yayını](WEBSITE.md) da hazırlanır.

1. Web ZIP dosyasını boş bir yayın dizinine açın. `index.html`, `assets/`,
   `THIRD_PARTY_NOTICES.txt`, `dependency-inventory.json` ve
   `LICENSE` birlikte tutulmalıdır.
2. HTTPS üzerinden servis edin. Yerel test için localhost HTTP kullanılabilir.
   ZIP'i doğrudan veya `file://` üzerinden açmayın.
3. Kök veya alt klasörde çalışır; örneğin `/editor/`. Göreli asset yolları vardır.
4. `index.html` için `Cache-Control: no-cache`; içerik özetli `assets/*`
   dosyaları için `Cache-Control: public, max-age=31536000, immutable` uygundur.
   Yayın değişiminde eski asset'leri açık oturumlar kapanana kadar koruyun.
5. `X-Content-Type-Options: nosniff` ve uygun bir Referrer-Policy yapılandırın.
   CSP kullanılacaksa `srcdoc` içindeki inline belge stilleri, `data:` medya,
   CodeMirror stilleri, resim Worker'ı için `worker-src blob:` ve izin verdiğiniz uzak medya kaynaklarını gerçek
   kurulumda doğrulayın; evrensel bir CSP başlığı bu pakette dayatılmıyor.

## Veri

Belgeler, medya ve şablonlar **kullanıcının tarayıcısında** IndexedDB'de saklanır.
Bu çıktı kullanıcı hesapları, sunucu yedeklemesi veya ekip senkronizasyonu sunmaz.
Kullanıcıya "kaydedildi" durumu yerel kaydı ifade eder.

Adres, port veya protokol değiştirmek farklı depolama alanı açar; önce yan menüden
**Yedekle / geri yükle → Tam yedeği indir** seçin. `.studio.json` dosyası belgeleri,
yorumları, önerileri, medya kütüphanesini, şablonları ve sürümleri içerir.
Yeni adreste aynı pencereden dosyayı doğrulatıp kopyalar olarak ekleyebilirsiniz.
HTML dışa aktarımı yalnız yayınlanacak belge içindir. Eski `tinymce-studio` IndexedDB adı, mevcut verileri
korumak amacıyla uyumluluk anahtarı olarak kalır.

## Yeniden üretme

Kaynak depoda Node.js 22.12+ veya 24+ ile:

```sh
npm ci
npm run package:release
```

Bu komut web ve Vue paketlerini derler, bağımlılık lisanslarını toplar ve
`release/` altında `.zip`, `.tgz`, SHA-256 özeti ve manifest üretir.
`npm run verify:release` paket içeriğini ve temiz tüketici entegrasyonunu
kontrol eder. Hiçbir komut npm'ye veya bir sunucuya yayın yapmaz.

npm adı/scope sahipliği ve gerçek mobil cihaz kontrolleri, npm'de kararlı sürüm yayımı öncesinde ayrıca tamamlanmalıdır. Mevcut sürüm beta olarak sunulur.
