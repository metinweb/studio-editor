# Mevcut CMS içinde Studio Editor kullanımı

Studio Editor, TinyMCE gibi mevcut uygulamanızdaki içerik alanına eklenir. Vue uygulamanızı, sayfa yapınızı veya yönetim panelinizi değiştirmez. Kayıt, kullanıcı yetkileri, SEO alanları, çeviriler ve yayınlama sizin CMS'inizde kalır.

## Vue ile kullanım

Paket henüz npm'de yayımlanmıyor. Bu depoda `npm run package:release` çalıştırıp oluşan yerel `.tgz` paketini uygulamanıza kurun. [Paket kurulum rehberi](../packages/editor/README.tr.md) ve [çalışan Vue örneği](../examples/vue/App.vue) ayrıntıları gösterir. Varsayılan medya kütüphanesi için uygulamada Pinia kurulmalıdır.

```vue
<script setup>
import { ref } from 'vue'
import { StudioEditor } from 'studio-editor'
import 'studio-editor/style.css'

const content = ref('<p>Mevcut içerik</p>')
const css = ref(['/assets/article.css'])
const editor = ref(null)
const emit = defineEmits(['save'])
function save() {
  emit('save', {
    html: editor.value.getHTML(),
    publicHtml: editor.value.getPublicHTML(),
  })
}
</script>

<template>
  <StudioEditor
    ref="editor"
    v-model="content"
    v-model:content-css="css"
    locale="tr"
    :height="550"
    @save="save"
  />
  <button type="button" @click="save">Kaydet</button>
</template>
```

Üst bileşende `save` olayını mevcut API'nize bağlayın. `getHTML()` düzenleme/yorum verilerini korur; `getPublicHTML()` yayınlanacak sürümden özel inceleme işaretlerini çıkarır. Sunucuda gelen HTML'i ayrıca doğrulayın ve temizleyin. Başarılı sunucu yanıtı almadan kullanıcıya kaydedildi demeyin.

## Düz HTML ile kullanım

`npm run build:library` çalıştırın. `packages/editor/dist/browser/` klasörünün **tamamını** sunucunuza kopyalayın. Bu paket Vue/Pinia'yı içerir; sayfanızda Vue kurulumu veya derleme aracı gerekmez. HTTP(S) üzerinden çalıştırın.

```html
<link rel="stylesheet" href="/vendor/studio-editor/studio-editor.css" />
<form method="post" action="/mevcut-kayit-adresiniz">
  <label for="content">İçerik</label>
  <textarea id="content" name="content" required>&lt;p&gt;Mevcut içerik&lt;/p&gt;</textarea>
  <!-- Uygulamanızın CSRF alanını buraya ekleyin. -->
  <button type="submit">Kaydet</button>
</form>
<script type="module">
  import { mountStudioEditor } from '/vendor/studio-editor/studio-editor.js'
  const editor = await mountStudioEditor('#content', {
    locale: 'tr',
    contentCss: ['/assets/article.css'],
    onSave: () => document.querySelector('form').requestSubmit(),
  })
</script>
```

HTML otomatik olarak textarea değerine yazılır; normal form gönderimi ve `FormData` çalışır. `required`, `readonly`, `disabled`, form sıfırlama ve birden fazla editör desteklenir. Sunucudan textarea içine yazılan HTML mutlaka kaçırılmalıdır. `editor.destroy()` editörü kaldırıp güncel içerikle textarea'yı geri getirir.

`editor.isDirty()` değişiklik durumunu verir. Kayıt başarılı olduktan sonra `editor.markClean()` çağrılabilir. Dışarıdan içerik değiştirmek için `editor.setHTML(html)` kullanın. `input` ve `change` olayları her içerik güncellemesinde tetiklenir. [Canlı HTML örneği](https://metinweb.github.io/studio-editor/integration/) form verisini gösterir; bir sunucuya kayıt yapmaz.

## Hangi özellikler açılıp kapatılabilir?

| Ayar                 | Varsayılan         | Kullanım                                                                                  |
| -------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| `toolbar`            | `true`             | `false`: araç çubuğunu gizle. Dizi: yalnızca seçilen grupları göster.                     |
| `menubar`            | `true`             | `false`: menü çubuğunu gizle. Dizi: yalnızca seçilen menüleri göster.                     |
| `readonly`           | `false`            | Düzenlemeyi kapat; seçme/kopyalama açık kalsın.                                           |
| `disabled`           | `false`            | Etkileşimi kapat. HTML entegrasyonunda alan form verisine dahil edilmez.                  |
| `allowContentCss`    | `true`             | Kullanıcının içerik CSS ayarları penceresini açabilmesi. Koddan verilen CSS'i engellemez. |
| `contentCss`         | `[]`               | Sırasıyla uygulanacak en fazla 10 harici CSS adresi.                                      |
| `mentions`           | `[]`               | Kendi kullanıcı/bahsetme önerilerinizi verin.                                             |
| `allowCreateMention` | `false`            | Serbest yerel bahsetme adı eklemeye izin verin. Bildirim gönderilmez.                     |
| `pasteMode`          | `keep`             | `keep`: biçimi koru; `clean`: temizle; `text`: düz metin.                                 |
| `tablePasteStyle`    | `target`           | `target`: hedef tablo stili; `source`: desteklenen kaynak stilleri.                       |
| `locale`             | `en`               | Arayüz: `en` veya `tr`. İçeriği çevirmez.                                                 |
| `direction`          | `ltr`              | Yazı yönü: `ltr`, `rtl`, `auto`.                                                          |
| `height`             | `600`              | Piksel veya `70vh` gibi CSS yüksekliği; en az 320px.                                      |
| `placeholder`        | Boş                | Boş içerik için ipucu; HTML'e eklenmez.                                                   |
| `mediaAdapter`       | Yerel kütüphane    | Kendi medya servisinize bağlanır; kurulumda seçilir.                                      |
| `messages`           | Yerleşik çeviriler | Bu editöre özel arayüz metinleri.                                                         |

Araç grupları: `history` (geri al/yinele), `typography` (başlık/font/boyut), `format` (metin biçimi), `color`, `align`, `lists`, `insert`, `tools`, `review`.

Menüler: `file`, `edit`, `view`, `insert`, `format`, `table`, `tools`, `help`.

```js
const editor = await mountStudioEditor('#content', {
  toolbar: ['history', 'format', 'lists', 'insert'],
  menubar: ['edit', 'insert', 'format'],
  allowContentCss: false,
  pasteMode: 'clean',
})
editor.setOptions({ readonly: true })
```

Vue karşılığı: `:toolbar="['history', 'format', 'lists']"`, `:menubar="false"`, `:readonly="true"`. Boolean değerleri düz metin olarak değil, `:` ile bağlayın.

**Bir düğmeyi gizlemek o özelliği tamamen kapatmak değildir.** Klavye kısayolları, sağ tık menüsü, komut API'si veya yapıştırma yoluyla aynı işlem erişilebilir olabilir. Yerleşik özellikler için tek tek komut engelleme listesi şu anda yoktur. İçerik/yetki kısıtlarını sunucuda uygulayın. Kendi eklenti komutlarınızın `enabled` fonksiyonu ve kaldırma fonksiyonu kullanılabilir.

Otomatik düzeltme, kalıcı kalem, görsel işaretler ve başlık gezgini ilgili menülerden açılıp kapatılır. Ortak düzenleme modülü siz bağlamadıkça etkin değildir.

## Ayarlardan harici CSS eklemek

Denemek için [örnek içerik CSS dosyası](../examples/html/article-theme.css) da eklendi. Canlı demoda `https://metinweb.github.io/studio-editor/integration/article-theme.css` adresini kullanabilirsiniz.

1. **Görünüm → İçerik stili ayarları** menüsünü açın. İngilizce: **View → Content style settings**.
2. Her satıra bir CSS dosyası adresi yazın. Örnek: `https://siteniz.com/assets/article.css`.
3. **Stilleri uygula** düğmesine basın. Dosya başına yüklenme/hata durumu gösterilir.
4. Kaldırmak için **Varsayılan stile dön** düğmesini kullanın.

CSS yalnızca ilgili editörün içerik iframe'ine ve **Görünüm → Belge önizlemesi** alanına uygulanır. Araç çubuğu ve uygulamanızın dış arayüzü etkilenmez. HTML kaydına, DOCX'e veya bağımsız HTML dışa aktarımına CSS bağlantısı eklenmez; siteniz yayınlanan içeriğin stilini kendisi yüklemelidir. Stil değişikliği içerik ve geri alma geçmişini sıfırlamaz.

Demo çalışma alanında adresler bu tarayıcıda hatırlanır. Entegrasyonda ayarları kalıcı saklamak sizin uygulamanıza aittir: Vue'da `v-model:content-css`, düz HTML'de `onContentCssChange(urls)` kullanılabilir. Yükleme durumları `content-css-status` / `onContentCssStatus` ile alınır. Koddan `editor.setOptions({ contentCss: ['/assets/theme.css'] })` uygulanabilir.

Yalnızca güvendiğiniz CSS dosyalarını kullanın. HTTP(S) dışındaki şemalar ve kullanıcı adı/parola içeren adresler reddedilir. HTTPS sayfalarda HTTPS CSS kullanın; CSP ve sunucunun dosya erişim kuralları geçerlidir. Göreli adresler sayfanızın adresine göre çözülür. `.site-wrapper .article p` gibi dış uygulama yapısına bağlı seçiciler iframe'de eşleşmez; `body`, `p`, `h2`, `table` gibi içerik seçicileri içeren bir dosya kullanın.

[İngilizce rehber ve API ayrıntıları](CMS-INTEGRATION.md)
