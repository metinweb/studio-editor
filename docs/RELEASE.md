# Yayın ve dağıtım

Studio Editor, **MIT lisansıyla** açık kaynak olarak yayımlanır. Depo [metinweb/studio-editor](https://github.com/metinweb/studio-editor), tanıtım ve demo GitHub Pages üzerinde hazırlanır. Mevcut sürüm **0.1.0-beta.12**'dir.

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
- `release/studio-editor-0.1.0-beta.12-web.zip`: statik sunucuya kurulacak dosyalar.
- `release/studio-editor-0.1.0-beta.12.tgz`: yerel npm kurulumu.
- `release/manifest.json`, `release/SHA256SUMS.txt`: sürüm, lisans, boyut ve SHA-256.
- `.package-smoke/`: gerçek `.tgz` dosyasını kuran geçici tüketici projesi.

Web/Vue paketleri MIT `LICENSE`, üçüncü taraf lisans metinleri ve bağımlılık envanteri içerir. Mermaid ile gelen `elkjs` EPL-2.0 lisanslıdır; değiştirilmeden ayrı bir parça olarak dağıtılır ve bildirim dosyası her bileşenin kaynak kod adresini listeler. `studio-editor/lite` Mermaid ve elkjs içermez. `package:release` ve `verify:release` yalnız yerel dosyalar oluşturur ve doğrular; npm veya GitHub yayımı yapmaz.

## npm ve kararlı sürüm

**0.1.0-beta.12, 26 Ekim 2026'da GitHub Packages'ta `@metinweb/studio-editor` adıyla herkese açık olarak yayımlandı** ([paket sayfası](https://github.com/users/metinweb/packages/npm/package/studio-editor)). npmjs.org yayını, depoya `NPM_TOKEN` eklenip etiket yeniden çalıştırılınca yapılır; 26 Ekim 2026 itibarıyla `studio-editor` adı npm'de kayıtlı değildir. Kaynak paketteki `private: true` yanlışlıkla yerel yayını önler.

Yayın `.github/workflows/publish.yml` ile yapılır. `packages/editor/package.json` sürümüyle eşleşen bir etiket (`v0.1.0-beta.12`) gönderildiğinde iş akışı lint, tip, birim ve kurulu paket testlerini çalıştırır, etiket/sürüm eşleşmesini denetler ve tarball'ın `private` alanı kaldırılmış kopyalarını yayımlar. Ön sürümler (`-beta`) `beta` dist-tag'iyle yayımlanır.

- **GitHub Packages:** her etikette iş akışının kendi `GITHUB_TOKEN`'ıyla `@metinweb/studio-editor` adıyla yayımlanır; ek gizli anahtar gerekmez.
- **npmjs.org:** depoya `NPM_TOKEN` gizli anahtarı (npm otomasyon token'ı) eklendiğinde aynı iş akışı `studio-editor` adıyla `--provenance` kullanarak yayımlar. Bu anahtar yoksa adım atlanır.

GitHub Packages'tan kurulum (GitHub'ın npm kayıt deposu, herkese açık paketler için de `read:packages` yetkili bir token ister):

```sh
# .npmrc
@metinweb:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}

npm install @metinweb/studio-editor@beta vue@^3.5 pinia
```

`import { StudioEditor } from '@metinweb/studio-editor'`; alt yollar aynıdır (`/style.css`, `/browser`, `/lite`). **Actions → Publish npm package → Run workflow** ile `dry-run` seçili çalıştırıp paket içeriğini yayımlamadan görebilirsiniz. Kaynak paket `private: true` olarak kalır; yerel `npm publish` bu yüzden reddedilir.

Mevcut beta, bağımsız güvenlik incelemesi veya bütün fiziksel cihazlarda kabul testi yapıldığı anlamına gelmez. NVDA, VoiceOver, Android emülatöründe Chrome ve iOS simülatöründe Safari testleri `.github/workflows/assistive.yml` ile her gönderimde çalışır ([ayrıntılar](PLATFORM-FEATURES.tr.md#gerçek-ekran-okuyucular-ve-mobil-tarayıcılar)). Fiziksel telefonlar, TalkBack, iOS VoiceOver ve kompozisyonlu klavyelerle kontroller ve deneysel ortak düzenlemede eş zamanlı yapısal değişiklikler açık çalışma alanlarıdır. Medya ve iş birliği sunucuları referans uygulamalardır.

## Tarihsel temizlik kaydı

24 Eylül 2026'da eski TinyMCE dağıtımına ait 137 dosya proje dışındaki yerel arşive taşındı; bu dosyalar kaynak depoya ve dağıtımlara dahil edilmez. Editör motoru bu projede geliştirilmiştir. Kaynak ve testlerdeki TinyMCE referansları bağımsızlık denetimi ve tarihsel açıklamalardır.

`tinymce-studio` IndexedDB adı eski yerel belgelerin erişimini korumak için değiştirilmemiştir. Kayıtlar tarayıcı origin'ine bağlıdır; yerel ortamdan Pages'e taşımak için tam yedek dışa/içe aktarma kullanılır.
