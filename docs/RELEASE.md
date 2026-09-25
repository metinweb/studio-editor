# Yayın ve dağıtım

Studio Editor, **MIT lisansıyla** açık kaynak olarak yayımlanır. Depo [metinweb/studio-editor](https://github.com/metinweb/studio-editor), tanıtım ve demo GitHub Pages üzerinde hazırlanır. Mevcut sürüm **0.1.0-beta.11**'dir.

## GitHub ve GitHub Pages

`main` dalına gönderilen değişiklikler `.github/workflows/ci.yml` üzerinden birim testleri, Chromium/Firefox/WebKit senaryoları, web/Vue derlemeleri ve tanıtım sayfası kontrollerinden geçer. Başarılı kontrollerden sonra `site-dist/` çıktısı GitHub Pages'e gönderilir. Pull request'ler test edilir, yayın yapmaz.

- [Tanıtım sayfası](https://metinweb.github.io/studio-editor/)
- [Editör demosu](https://metinweb.github.io/studio-editor/demo/)
- [Website kaynakları ve yerel önizleme](WEBSITE.md)

## Yerel dağıtım dosyaları

```sh
npm ci
npm run package:release
npm run verify:release
```

- `dist/`: bağımsız web uygulaması.
- `packages/editor/dist/`: Vue bileşeni ESM ve CSS çıktısı.
- `release/studio-editor-0.1.0-beta.11-web.zip`: statik sunucuya kurulacak dosyalar.
- `release/studio-editor-0.1.0-beta.11.tgz`: yerel npm kurulumu.
- `release/manifest.json`, `release/SHA256SUMS.txt`: sürüm, lisans, boyut ve SHA-256.
- `.package-smoke/`: gerçek `.tgz` dosyasını kuran geçici tüketici projesi.

Web/Vue paketleri MIT `LICENSE`, üçüncü taraf lisans metinleri ve bağımlılık envanteri içerir. `package:release` ve `verify:release` yalnız yerel dosyalar oluşturur ve doğrular; npm veya GitHub yayımı yapmaz.

## npm ve kararlı sürüm

Paketler henüz npm kayıt deposuna yayımlanmadı. `private: true` yanlışlıkla npm yayımını önler; GitHub görünürlüğünü ve MIT lisansını etkilemez. npm adı/scope sahipliği ayrıca doğrulanmalıdır.

Mevcut beta, bağımsız güvenlik incelemesi veya bütün fiziksel cihazlarda kabul testi yapıldığı anlamına gelmez. Gerçek mobil/IME/ekran okuyucu kontrolleri ve deneysel ortak düzenlemede eş zamanlı yapısal değişiklikler açık çalışma alanlarıdır. Medya ve iş birliği sunucuları referans uygulamalardır.

## Tarihsel temizlik kaydı

24 Eylül 2026'da eski TinyMCE dağıtımına ait 137 dosya proje dışındaki yerel arşive taşındı; bu dosyalar kaynak depoya ve dağıtımlara dahil edilmez. Editör motoru bu projede geliştirilmiştir. Kaynak ve testlerdeki TinyMCE referansları bağımsızlık denetimi ve tarihsel açıklamalardır.

`tinymce-studio` IndexedDB adı eski yerel belgelerin erişimini korumak için değiştirilmemiştir. Kayıtlar tarayıcı origin'ine bağlıdır; yerel ortamdan Pages'e taşımak için tam yedek dışa/içe aktarma kullanılır.
