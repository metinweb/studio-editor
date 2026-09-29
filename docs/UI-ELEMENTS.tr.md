# Düz HTML UI öğeleri

Editörün içine **form oluşturucu, slider ve akordeon/SSS** eklendi. Yayınlanan öğeler standart HTML ve satır içi CSS kullanır; Vue bileşeni veya ek JavaScript çalışma zamanı gerektirmez. [Canlı örnek](https://metinweb.github.io/studio-editor/integration/ui.html) · [İngilizce API rehberi](UI-ELEMENTS.md).

## Nasıl kullanılır?

**Ekle → Form oluşturucu / Slider oluşturucu / Akordeon oluşturucu** menüsünü açın. Mevcut öğenin üzerine tıklayarak yeniden düzenleyin. Klavyeyle odağa alıp Enter/Boşluk ile de açabilirsiniz. Değişiklik ve kaldırma işlemleri geri alınabilir. Oluşturucu açıkken belge başka yerden değişmişse eski taslak uygulanmaz.

- **Oluştur:** alan/öğe ekleme, seçme, özellik düzenleme, çoğaltma, silme. Tutamacı sürükleyerek sıralayın; yukarı/aşağı düğmeleri dokunmatik ve klavye için de kullanılabilir.
- **Ayarlar:** başlık, açıklama, vurgu rengi ve öğeye özel seçenekler.
- **Önizlemeyi dene:** masaüstü/telefon görünümünde gerçek kontrolleri deneyin. Önizleme alanından form gönderimi engellenir.

## Form oluşturucu

En fazla **40 alan**: kısa metin, e-posta, telefon, web adresi, sayı, tarih, uzun metin, açılır liste, tek seçim, onay kutusu ve **değer kaydırıcısı**.

Etiket, alan adı, yer tutucu, yardım metni, zorunluluk ve tam genişlik ayarlanabilir. Açılır liste/tek seçimde her satıra bir seçenek girilir; 1–30 farklı seçenek kabul edilir. Sayı/değer kaydırıcısında alt sınır, üst sınır ve adım belirlenir. Alan adları benzersiz olmalı, harfle başlamalı ve en fazla 64 ASCII harf/sayı/alt çizgi içermelidir. Sunucuya bu adlarla gönderilir.

Bir veya iki sütun seçilebilir; dar ekranlarda alanlar alt alta gelir. Tarayıcının zorunlu alan, e-posta, URL ve sayı denetimleri kullanılır. Telefon biçimi ve iş kurallarını sunucunuz doğrulamalıdır.

**Ayarlar → Gönderim adresi (POST)** alanına `https://siteniz.com/api/contact` veya `/api/contact` gibi bir adres girin. Adres boşsa yayınlanan form kapalıdır. Form standart URL-encoded POST gönderir; dosya yükleme, gizli/parola alanı veya keyfi script kabul edilmez.

Editör yanıtları kaydetmez, e-posta göndermez ve backend kurmaz. Yanıt kaydı, başarı/hata sayfası, yetkilendirme, CSRF, spam denetimi ve sunucu doğrulaması sizin uygulamanıza aittir. CSRF için gizli alan gerekiyorsa yayınlanan forma sunucu tarafında ekleyin; gizli anahtarları düzenlenebilir tanıma kaydetmeyin. Çok adımlı form ve koşullu alan mantığı bu sürümde yoktur.

Yayınlanan formu başka bir `<form>` içine koymayın. CMS’inizdeki mevcut form içine editör yerleştirmek güvenlidir: düzenleme görünümünde gerçek form kontrolleri yerine gönderim yapmayan kartlar kullanılır.

## Slider

En fazla **20 slayt**. Her slaytta başlık, metin, isteğe bağlı görsel adresi, görsel için alternatif metin ve isteğe bağlı bağlantı bulunur. Masaüstünde 1–3 kart; 16:9, 4:3 veya 1:1 görsel oranı seçilebilir.

Dokunarak veya yatay kaydırarak, klavyeyle ya da numaralı bağlantılarla gezinilir. CSS scroll snapping kullanır. Otomatik oynatma, sonsuz döngü ve ek JavaScript yoktur. Görsel eklenmeyen kart numaralı bir yer tutucu gösterir. Görseller URL ile girilir; dosya yükleme mevcut medya kütüphanesinde ayrı yapılır.

## Akordeon / SSS

En fazla **20 bölüm**; her bölümde başlık, düz metin ve başlangıçta açık/kapalı seçimi bulunur. Native `<details>` / `<summary>` ile çalışır; script gerektirmez. Bölümler bağımsız açılır. Metinler HTML olarak çalıştırılmaz.

## HTML ve Vue entegrasyonu

```js
const editor = await mountStudioEditor('#content', {
  locale: 'tr',
  features: { uiElements: true },
})
editor.openUiElement('form')
editor.openUiElement('slider')
editor.openUiElement('accordion')

// Bütün UI oluşturucularını kapat:
editor.setOptions({ features: { uiElements: false } })
```

Vue’da `:features="{ uiElements: true }"` kullanın; component ref aynı API’yi sağlar. `readonly` ve `disabled` ayarları da geçerlidir. Varsayılan olarak araçlar açıktır. [Temel CMS kurulumu](CMS-INTEGRATION.tr.md).

Koddan form üretme:

```js
import { newUiElement, uiElementHtml } from 'studio-editor'

const form = newUiElement('form', 'tr')
form.title = 'Teklif isteyin'
form.action = '/api/teklif'
form.columns = 2
form.fields.push({
  type: 'checkbox',
  name: 'consent',
  label: 'İletişime geçilmesini kabul ediyorum',
  required: true,
})
editor.insertHTML(uiElementHtml(form))
```

## Kaydetme ve yayınlama

**Düzenlenebilir kaydı `getHTML()` veya Vue `v-model` ile saklayın; yayın için `getPublicHTML()` kullanın.** Öğenin tanımı `data-studio-ui-config` içinde sürümlü JSON olarak tutulur. JSON belge modelinde etkileşimli form etiketleri yerine taşınabilir bir figür bulunur. Yeniden yüklemede editör görünümü, yayında gerçek HTML kontrolleri oluşturulur. Ziyaretçinin form cevapları tanıma kaydedilmez.

Tam HTML dosyası için `renderDocument({ title, content: editor.getHTML(), locale: 'tr' })` kullanılabilir. Canlı örnekte **Download HTML** aynı çıktıyı verir. İçerik bir sayfaya ekleniyorsa `getPublicHTML()` yeterlidir; ek widget script’i gerekmez. Sunucunuz `data-studio-*` verilerini kaldırıyorsa düzenlenebilir asıl kaydı ayrıca tutun.

Aynı belgeye kopyalanan öğelerin etiket/hedef kimlikleri ayrıştırılır. Bağımsız belgelerden çıktıları birleştirirken öğe kimliklerini benzersiz tutun. Kendi CSS’iniz kontrollerin görünümünü etkileyebilir. DOCX/Markdown/PDF etkileşimli form veya slider davranışını korumaz.

Sürükleme, native POST verisi, önizlemede gönderimin engellenmesi, slider bağlantıları, akordeon, geri alma, HTML/JSON dönüşümü, geçersiz tanımlar, özellik kapatma ve mobil Türkçe kullanım tarayıcı testleriyle doğrulanır.
