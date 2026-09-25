# Günlük yazma araçları

25 Eylül 2026: kullanıcının beş aşamalı sırasının ilk aşaması uygulandı. Kaynak ve yerel web/Vue derlemeleri güncel; eski beta.10 dağıtım arşivleri yeniden paketlenmedi.

## Kullanım

- **Canlı başlık gezgini:** Araç çubuğundaki başlık simgesi veya Görünüm → Belge başlıkları. H1–H6 başlıkları yazarken, silerken ve geri alırken güncellenir. Başlığa tıklamak imleci ilgili bölüme taşır. Gezgin belgeye yeni kimlik eklemez; içindekiler bloğundan bağımsızdır. Dar ekranda kapatılabilir bir paneldir.
- **Görev listeleri:** Araç çubuğu, Ekle menüsü, `/task` veya paragraf başında `[ ] ` / `[] `. Enter yeni görev açar; boş görevde Enter listeden çıkar. Tab/Shift+Tab girintiyi değiştirir. Kutucuğa tıklama, kutucuk odaktayken Space/Enter veya görev içindeyken Ctrl/Cmd+Enter tamamlanma durumunu değiştirir. Aynı düğme mevcut görev listesini normal listeye çevirir. Dönüşüm seçili öğenin ait olduğu listeye uygulanır.
- **Bahsetmeler:** Kelime başında `@` ve bir ad yazın; ↑/↓/Enter ile seçin, Escape ile kapatın. E-posta, bağlantı, kod ve medya öğelerinin içinde açılmaz. Bağımsız uygulama yeni yerel adlar oluşturur ve belgedeki adları yeniden önerir. Bahsetme bildirim veya davet göndermez.
- **İçerik stilleri:** Palet menüsünde giriş yazısı, bilgi, uyarı ve başarı kutuları. Normal metin, adlandırılmış stili kaldırır; kalın/italik gibi satır içi biçimleri korur. Menü imlecin bulunduğu bloğun stilini gösterir.
- **Genişletilmiş `/` menüsü:** Görevler, dört içerik stili, 3×3 tablo, medya kütüphanesi, bağlantıdan medya ve şablonlar. Mevcut başlık/liste/alıntı/kod/çizgi komutları da korunur. Arama Türkçe/İngilizce ad veya komut kimliğiyle yapılır. Açılan ekleme penceresini iptal etmek `/` metnini silmez. Komutlar boş bir üst düzey paragrafta çalışır.

## Vue bileşeni

```vue
<StudioEditor v-model="html" :mentions="people" :allow-create-mention="false" />
```

`people`, `{ id: string, label: string }[]` biçimindedir. `id` en fazla 120, `label` en fazla 80 karakterdir. Kimlik kalıcıdır; görünen etiket belgeye kaydedilir. Vue bileşeninde serbest ad oluşturma varsayılan olarak kapalıdır. Mevcut belgede bulunan bahsetmeler yeniden önerilebilir; bu liste bir yetkilendirme sistemi değildir. Asenkron kişi araması veya bildirim servisi bu sürümde yoktur. Uygulama kendi kişi kaynağını diziye yükleyebilir.

`registerPlugin()` ile kaydedilen etkin komutlar başlıklarıyla `/` menüsüne gelir. Kaydı kaldırma menüyü günceller; yürütme mevcut komut kayıt sisteminin readonly/disabled denetiminden geçer. Eklenti ekleme yapacaksa `insertHTML()` seçili `/sorgu` metnini değiştirir. Belgeyi değiştirmeyen komutlar sorguyu kendiliğinden silmez.

## Saklama ve çıktı sözleşmesi

```html
<ul data-studio-task-list="true">
  <li data-studio-checked="false">Görev</li>
</ul>
<p><span data-studio-mention="person-42" data-studio-mention-label="Deniz">@Deniz</span></p>
<p data-studio-style="info">Bilgi</p>
```

Görev, bahsetme ve stil verileri HTML ve JSON şema 2 içinde korunur. Checkbox kontrolleri ve `contenteditable` davranışı model yüklenirken türetilir; JSON modelinde editör kontrolleri saklanmaz. Geçersiz bahsetme verisi temizlenir; geçerli etiketin içeriği kayıtlı addan yeniden üretilir. Zengin yapıştırma bu anlamsal verileri korur; düz metin yapıştırma yalnız metni taşır. Normal metin biçimleme ve bul/değiştir bahsetme etiketinin içini değiştirmez.

HTML önizleme/dışa aktarımında stiller ve işaretli görev görünümü belge CSS'iyle korunur; `getPublicHTML()` kullanan sayfa da paket CSS'ini yüklemelidir. Dışa aktarılan görev kutuları salt okunurdur. DOCX'te etkileşimli checkbox, bahsetme kimliği ve kutu stillerinin birebir korunması bu aşamanın kapsamında değildir.

## Doğrulama

Sonuç: Chromium, Firefox ve WebKit üzerinde günlük yazma, mevcut yazma araçları, menüler/seçim, çekirdek düzenleme, pano, içerik araçları ve medya gömme senaryolarında **195/195** test geçti. Node birim testleri **41/41** geçti. Web ve Vue kütüphanesi derlendi; paket tipi denetimi ve Pinia ile SSR render kontrolü geçti.

`tests/daily-writing.spec.js`: başlık güncelleme/gezinme, görev kaydı ve undo, klavye/girinti, zengin pano, bahsetme oluşturma/yeniden kullanım/iptal, stil sıfırlama, slash/dialog iptali ve dar ekran sınırları.

`node scripts/check-daily-writing.mjs`: derlenmiş Vue bileşeninde yapılandırılmış kişi listesi, serbest oluşturmanın kapalı olması, JSON model, iki editör arasında anlamsal aktarım, kalıcı blok kimliği, salt okunur görevler ve eklenti slash komutu. Bu aktarım testi bütün eş zamanlı yapısal düzenlemeler için kabul testi değildir.

Masaüstü ve mobil görüntüler: [screenshots/daily-writing](screenshots/daily-writing). Gerçek ekran okuyucu ve fiziksel telefon oturumları yapılmadı.

## Sıradaki aşama

Bütün düzenlemeleri ortak belge işlemlerinden geçirmek. DOM hâlâ düzenleme katmanının otoritesidir; bu eklemeler mevcut transaction/geçmiş/model köprüsünü kullanır. Otomatik Track Changes, canlı imleçler, kilitli alanlar, kalıcı değişkenler, DOCX içe aktarma, tam Markdown alışverişi, sayfalama ve isteğe bağlı hizmetler bu çalışmayla tamamlanmış sayılmaz.
