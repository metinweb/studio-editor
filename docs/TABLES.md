# Tablolar — beta.9

## Hücre seçimi ve pano

- İlk hücreye tıklayıp son hücreye **Shift+tık**: dikdörtgen seç.
- Fareyi basılı tutarak başka hücreye sürükle: dikdörtgen seç.
- **Alt+Shift+ok**: klavyeyle seçimi genişlet. **Esc**: hücre seçimini kapat.
- **Delete/Backspace**: seçili hücre içeriklerini temizle; tablo yapısı kalır.
- **Ctrl/⌘+C/X** veya sağ tık menüsünden kopyala/kes: HTML tablo ve TSV aktar.
  Kesme işlemi tabloyu kaldırmaz, yalnızca seçili hücreleri boşaltır.
- **Ctrl/⌘+A** hücre seçimini bırakıp yerel tümünü seç davranışına döner.
  Normal yön tuşları/Tab/Enter ve yazım hücre seçimini kapatır.

Seçim DOM hücre indeksi yerine `rowspan`/`colspan` içeren mantıksal koordinat
modelini kullanır. Birleşik hücreye değen seçim onun tamamını kapsayacak şekilde
genişler. Mavi katman ve hücre sayısı belge HTML'ine veya geçmişe yazılmaz.
Toplu hücre biçimi için aşağıdaki Hücre biçimi penceresini kullanın.

Excel/Sheets TSV veya temizlenmiş HTML tablo, imlecin bulunduğu hücreden
başlayarak mevcut hücrelere dağıtılır. Seçili alan varsa kaynak boyutuyla aynı
olmalıdır. Tek değer seçili hücrelere tekrarlanabilir. Hedef hücrelerin stili ve
başlık türü temel alınır, içerikleri değiştirilir. Her yapıştırma/kesme/temizleme
tek undo adımıdır. `transaction.kind` sırasıyla `pasteCells`/`clearCells` olur;
`paste` olayı önceki sözleşmeyle çalışır.

Beta.8, HTML kaynağındaki `rowspan`/`colspan` birleşimlerini hedef alana taşır.
Normal tablo/TSV yapıştırıldığında tamamen kapsanan birleşik hedef hücreler
normal hücrelere ayrılır. Bu, hedef alanın içerik ve birleşim düzenini değiştirir;
eski içerik geri almayla geri gelir. Hedef alan dışındaki hücreler korunur.

Yeni hücre, hedefteki başlangıç koordinatının türünü ve stilini temel alır.
Yeni oluşan alt hücrelere hedefin style/scope bilgisi aktarılır; genişlik/yükseklik
çoğaltılmaz ve id kopyalanmaz. Birleşimle kaldırılan hücrelerin id/stil bilgileri
sonuçta tutulmaz. Kaynağın tablo temaları, açıklama ve sütun
genişlikleri aktarılmaz; hedef colgroup, açıklama ve bölüm yapısı korunur.
Kaynak içeriğinin satır içi biçimi `keep` modunda korunur, `clean` modunda
temizlenir. Her iki modda birleşimler taşınır; `text` modunda taşınmaz.

Sığmayan veri tabloyu kendiliğinden büyütmez; satır/sütun ekleme uyarısı verir.
Hedef birleşimin yalnız bir bölümü kapsanıyorsa veya kaynak rowspan hedefteki
thead/tbody/tfoot sınırını aşıyorsa işlem bütünüyle reddedilir. Boyutu uymayan
seçim, delikli/çakışan kaynak, iç içe tablo veya tablo dışında ek içerik de
reddedilir. Belge ve undo geçmişi değişmez; sessiz kırpma yapılmaz.

Tek 1×1 kaynak değeri, aktif birleşik hücreyi veya seçili fiziksel hücreleri
birleşimlerini değiştirmeden doldurur. Bir tek hücre 2×2 alanı kapsıyorsa kaynak
2×2 sayılır. `paste.rows/columns` mantıksal boyutları bildirir. Kaynaktaki
`rowspan="0"` açık sayıya normalize edilir; hedef alan dışındaki değer korunur.

Kopyalamanın HTML verisi birleşimleri korur; TSV birleşim bilgisi taşımaz ve
kapsanan devam konumlarına boş değer yazar. Excel aktarımında birleşimleri
korumak için panoda HTML temsilinin bulunması gerekir. Otomatik testler
temsilî HTML/TSV panolarıdır; gerçek Excel sürümleri henüz ayrıca doğrulanmadı.

## Yapıştırırken hücre biçimi — beta.9

**Tablo → Tablo yapıştır: hedef biçimini koru** varsayılandır. **Kaynak hücre
biçimini kullan** seçeneği, `keep` (biçimi koru) modunda HTML kaynak hücrelerinin
desteklenen açık stillerini taşır: dolgu/metin rengi, yazı tipi/boyutu/kalınlığı,
hizalama, satır yüksekliği, iç boşluk ve ayrı kenar çizgileri. `bgcolor`, `align`
ve `valign` de CSS'e çevrilir; açık CSS değeri bu özniteliklere göre önceliklidir.

Kaynak seçeneği hedefteki desteklenen hücre stillerini önce kaldırır; kaynakta
belirtilmeyen özellikler editörün/tabloların varsayılanına döner. Kimlik, scope,
th/td türü, genişlik/yükseklik, sütunlar ve tablo yapısı hedefe aittir. Kaynak
sınıfları/stil sayfaları, üst öğelerden miras alınan stiller, kaynak ölçüleri,
konumlandırma, CSS değişkenleri, kaynak URL'leri ve !important aktarılmaz.
Kaynağın birebir piksel görünümü garanti edilmez.

`clean`, `text` ve yalnız TSV yapıştırma hedef biçimini korur. Menü tercihi
değişmez; sonraki `keep` + HTML yapıştırmada yeniden geçerli olur. Tek hücreyi
seçili alana dağıtma ve birleşik hücre aktarımı aynı tercihi kullanır. İçerik ve
biçim tek `pasteCells` işlemi olarak geri alınır. Tercih editör örneğine/oturumuna
aittir; Vue tarafında `tablePasteStyle="source"` veya
`v-model:table-paste-style="style"` kullanılabilir; diğer değer `target` olur.

## Toplu hücre biçimi

Seçili alanda hızlı araçlardan fırça simgesine, Tablo menüsünden veya sağ tıkla
**Hücre biçimi** seçeneğine ulaşın. Çoklu seçim yoksa aktif hücre düzenlenir.
Dolgu/metin rengi, yatay/dikey hizalama, 0–48 px iç boşluk ve 0–8 px kenarlık
uygulanabilir. Renkler altı haneli HEX; dolgu için şeffaf seçeneği de vardır.

Yalnızca değiştirdiğiniz alanlar uygulanır. Farklı hücre stilleri karışık
gösterilir; dokunmadığınız alanlar korunur. Ortak renkler girişte ipucu olarak
görünür. Örnek hücre taslağı gösterir; belge ancak **Hücrelere uygula** ile
değişir. Vazgeç/Esc belgeye dokunmaz. Tek işlem türü `formatCells` ve tek undo
adımıdır; uygulamadan sonra çoklu seçim korunur.

Tüm kenarlar, dış çerçeve, iç çizgiler ve kenarlıksız seçenekleri mantıksal
seçim sınırlarını kullanır; birleşik hücre içinden çizgi geçmez. Seçilmeyen
komşu hücrelerin kenarları değiştirilmez. CSS border-collapse çakışma kuralları
nedeniyle komşunun kalın çizgisi ortak sınırda görünmeye devam edebilir.

**Hücre biçimini sıfırla**, hücredeki dolgu/metin rengi, hizalama, padding ve
kenarlık stillerini kaldırır; içerik, span, başlık türü, genişlik ve kimlikleri
korur. İçerikteki özel renkli metinler ve hizalı paragraflar ayrıca değiştirilmez;
hücre stili, kendi stili olmayan alt öğelere miras kalır. Tablo teması/başlık
stili varsayılan görünümü etkiler. Genel metin araç çubuğu hâlâ metin seçimini
biçimlendirir; çoklu hücre işlemi bu pencereye özeldir.

Pencere açıkken dışarıdan belge değişirse eski taslak uygulanmaz; yeniden
seçim gerekir. Readonly/disabled geçişi taslağı kapatır. Pencere Türkçe ve
İngilizce sözlüğü kullanır; diğer gelişmiş panellerin çevirisi ayrı iştir.

## Birleştirme, ayırma ve yapısal işlemler

Bir alan seçip hızlı araçlardan **Seçili hücreleri birleştir** düğmesine basın.
Tablo ve sağ tık menülerinde ayrıca **Sağdaki hücreyle birleştir** ve **Alttaki
hücreyle birleştir** bulunur. Komşu birleştirmede ortak kenarlar hizalı olmalıdır;
daha büyük bir alan için dikdörtgen seçim kullanın. Birleştirme içeriği satır
sırasıyla, satır sonlarıyla ayırarak sol üst hücrede toplar; satır içi biçim,
bağlantı, medya ve içerikteki inceleme bilgileri korunur. Sonuç sol üst hücrenin
türünü/stilini alır; kaldırılan hücrelerin hücre düzeyindeki stil ve kimlikleri
sonuçta tutulmaz. Farklı `thead`/`tbody`/`tfoot` bölümleri birleştirilemez.

**Hücreyi ayır**, hem yatay hem dikey span'i normal hücrelere böler.
Birleşik içerik sol üstte kalır, diğer hücreler boş oluşturulur. Birleştirmeden
önceki özgün dağılıma dönmek için **Geri al** kullanın; ayırma bu dağılımı tahmin etmez.

Satır/sütun ekleme ve silme birleşik tablolarda da çalışır. Ekleme noktası
bir hücrenin içinden geçiyorsa o hücrenin span'i büyür; açıkta kalan konumlar
boş hücrelerle dolar. Satır ekleme aktif hücrenin başlangıç satırının önüne/
arkasına; sütun ekleme hücrenin sol/sağ kenarına yapılır. Çoklu seçimin tüm
satırlarını/sütunlarını tek seferde silmez: komut aktif başlangıç konumunu işler.

Silme sırasında birleşik hücre hâlâ başka satır/sütunları kapsıyorsa içerik
korunarak kalan alana taşınır ve span küçülür. Tamamen silinen hücrelerin
içeriği kaldırılır. Son mantıksal satır/sütun silinirse tablo kaldırılır.
Tüm işlemler tek undo adımıdır. Tablo sonundaki **Tab** yeni düzenlenebilir satır
ekler. `rowspan="0"` işlemlerde açık sayıya normalize edilir; Tab ile eklenen
son satırın önceki açık uçlu birleşime katılmaması sağlanır.

## Sütun boyutlandırma

Tablo seçiliyken iç sütun sınırları sürüklenebilir. Bir sütun genişlerken
komşusu daralır, toplam genişlik korunur. Tutamaca odaklanıp sağ/sol ok ile
1 px, Shift+ok ile 10 px değiştirilebilir. **Esc**, pointer iptali veya readonly
moduna geçiş sürüklemeyi geri alır. Değişiklik yapmadan tıklamak geçmiş eklemez.

Genişlikler `colgroup/col` içinde saklanır, `table-layout: fixed` kullanılır;
HTML aktarımı ve undo/redo ile korunur. Başlangıçtaki hücre genişlikleri sütun
tanımlarına taşınır. Basit tabloda sonraki sütun ekleme/silme tanımları günceller.
Birleşik hücrelerle tamamen örtülen ve görünür kenarı olmayan sütun sınırında
tutamaç gösterilmez. Tablo köşelerinden toplam genişliği değiştirme devam eder.

## Sınırlar ve doğrulama

Koordinat modeli 1.000 satır, 100 sütun ve 10.000 mantıksal konumla sınırlıdır.
Delikli/çakışan matrisler, bölüm sınırını aşan rowspan ve iç içe tablolar yeni
işlemler için reddedilir. `rowspan="0"` ait olduğu satır grubunun sonuna gider.
Beta.10 RTL geometri desteği ekler; `direction="rtl"` ile sütun tutamaçları
sağdan sola sınırları ve ters genişlik farkını izler. Klavye boyutlandırma üç
tarayıcıda doğrulanmıştır; gerçek dokunmatik cihaz kontrolü ayrıca gereklidir.
Birleşik tablolarda sıralama kapalıdır.

Chromium/Firefox/WebKit otomasyonu; seçim, TSV/HTML pano sözleşmesi, kopyalama,
taşma/boyut uyuşmazlığı, birleşik hücre koruması, resize/iptal/undo ve paket
mod değişimleriyle doğrulanır. Gerçek mobil dokunma, ekran okuyucu ve Office
uygulaması panoları ayrıca doğrulanmalıdır.
