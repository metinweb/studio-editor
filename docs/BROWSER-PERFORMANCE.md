# Tarayıcı performansı — beta.4

24 Eylül 2026, Windows, AMD Ryzen 9 7900, Node 24.5.0,
headless Chromium 153.0.8010.12, 1280×900. Üretim Vue paketini yükleyen Vite
ölçüm sayfası: `benchmarks/`. Tekrar çalıştırma: `npm run benchmark:browser`.
Ham çıktı [browser-benchmark.json](browser-benchmark.json), önceki beta.3
başlangıç koşusu [browser-benchmark-baseline.json](browser-benchmark-baseline.json).

| Belge           | Açılış ms | Giriş p50 / p95 ms | Seçim p50 / p95 ms | Undo ms | JS heap MiB |
| --------------- | --------: | -----------------: | -----------------: | ------: | ----------: |
| 1.000 paragraf  |      29,3 |        32,2 / 32,9 |        32,5 / 33,4 |    30,1 |        7,21 |
| 10.000 paragraf |     131,4 |        36,0 / 38,1 |        32,5 / 33,2 |    72,7 |        9,78 |
| 100×20 tablo    |      32,3 |        32,4 / 33,0 |        31,9 / 33,4 |    30,6 |        6,94 |
| 50 görsel       |      74,4 |        33,5 / 36,1 |        32,0 / 33,1 |    31,2 |        9,13 |

## Ölçülen şey

- Paketin tam editör arayüzü, `v-model` ve DOM motoru çalışır; web çalışma
  alanının otomatik kaydı, kelime sayımı ve yan panelleri dahil değildir.
- Açılış: hazır editöre `setHTML`, görsel `decode` ve iki animasyon karesi.
  İlk sayfa/bundle/ağ yükleme süresi değildir.
- Giriş: gerçek tarayıcı `keyboard.insertText` ile karakter ekleme;
  `beforeinput` başlangıcından iki `requestAnimationFrame` sonrasına kadar.
  İlk 3 örnek atılır, 20 örneğin p50/p95'i alınır. **Fiziksel tuştan ekrana
  gecikme değildir.** İki kare bekleme yaklaşık 32 ms taban oluşturur.
- Seçim: programatik caret yerleştirme, odağa alma, kaydırma ve iki kare;
  10 örnek. Gerçek fare sürükleme veya geniş aralık seçimi değildir.
- Undo ve açılış birer örnektir; istatistiksel performans garantisi vermez.
  Undo yazılmış karakter grubunu kaldırır; belge yükleme adımını kaldırmaz.
- Heap: GC sonrası CDP `Runtime.getHeapUsage().usedSize`, sayfa/runtime JS
  belleği. Süreç RAM'i, tüm DOM ve görsel çözme belleği değildir.
  [Chrome protokol sözleşmesi](https://chromedevtools.github.io/devtools-protocol/v8/Runtime/#method-getHeapUsage).
- Görseller geçerli 320×180 JPEG verisidir; aynı gömülü kaynak 50 kez kullanılır.
  50 farklı görselin ağ/çözme yükünü temsil etmez. Tablodaki yazım son paragraftadır;
  büyük tabloda hücre düzenleme ayrı ölçülmelidir.
- Geçmiş istatistiği ilk belge yüklemesini de içerir; eski saf geçmiş
  benchmark'ının yalnızca küçük değişimler hesabıyla doğrudan kıyaslanamaz.

Bu aşamada ölçüm altyapısı eklendi; hız artışı veya TinyMCE'den hızlı olma
iddiası yoktur. İki sürüm koşusu arasındaki küçük farklar gürültü olabilir.
Bu cihazda örnek giriş p95 değerleri 50 ms altında olsa da tüm cihazlarda
ürün hedefinin karşılandığı anlamına gelmez. 10.000 paragrafta açılış/undo,
tam web uygulaması, düşük güçlü cihazlar, büyük seçimler, tablo içi yazım,
IME ve farklı tarayıcılar sonraki profil çalışmasıdır.
