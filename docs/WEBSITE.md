# Tanıtım sayfası ve GitHub Pages

Tanıtım sayfasının kaynakları `website/` klasöründedir. Statik HTML, CSS ve küçük bir kopyalama betiği kullanır; harici yazı tipi, analiz servisi veya form içermez. Gerçek editör görüntüsü aynı klasörde bulunur.

```sh
npm ci
npm run build:site
npm run preview:site
npm run test:site
```

`build:site` editörü derler, tanıtım sayfasını `site-dist/` köküne ve çalışan editörü `site-dist/demo/` altına yerleştirir. Bağlantılar göreli olduğu için GitHub Pages proje alt yolu desteklenir. `site-dist/` üretilen çıktıdır ve Git'e alınmaz.

GitHub'da depo ayarlarında Pages kaynağı GitHub Actions olmalıdır. `.github/workflows/ci.yml`, `main` değişikliklerini ve pull request'leri test eder. `metinweb/studio-editor` deposunun `main` dalında başarılı testlerden sonra Pages yayını yapılır. Fork'lar ve pull request'ler yayın yapmaz.

Hedef adresler:

- Tanıtım: https://metinweb.github.io/studio-editor/
- Demo: https://metinweb.github.io/studio-editor/demo/

Demo, ziyaretçinin belgelerini kendi tarayıcısındaki IndexedDB'de saklar. Sunucuya belge yükleyen veya hesap oluşturan bir servis kurulmaz. GitHub Pages origin'i yerel geliştirme origin'inden farklı olduğu için eski yerel belgeler otomatik taşınmaz; tam yedek içe aktarımı kullanılabilir.

## Yerel doğrulama — 25 Eylül 2026

- 435/435 editör senaryosu Chromium, Firefox ve WebKit'te geçti.
- 45/45 Node birim testi geçti.
- Tanıtım sayfasının varlıkları, demo açma ve kayıt akışı, pano kopyalama/hata durumu ve mobil görünümü için 3/3 senaryo geçti.
- Web ve Vue kütüphane derlemeleri tamamlandı; masaüstü ve mobil ekran görüntüleri incelendi.
- Proje sahibi MIT lisansını, herkese açık `metinweb/studio-editor` deposunu ve GitHub Pages yayımını seçti. Güncel yayın durumu depodaki Actions ve Deployments kayıtlarından izlenebilir.
