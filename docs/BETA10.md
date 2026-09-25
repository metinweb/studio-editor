# Beta.10 — çalışma alanı, belge API'si ve ekip iş akışı

Bu belge beta.10'un tarihsel uygulama kaydıdır. Güncel proje beta.11 ile MIT lisansına geçti; [yayın belgesi](RELEASE.md) güncel GitHub/Pages ve paketleme durumunu açıklar. npm yayımı yapılmadı.

## Kullanım

- Yan menü **Yedekle / geri yükle**: belge, yorum, öneri, medya, şablon ve sürümler. 100 MB JSON arşivi, şema 1 ve SHA-256 bütünlük denetimi. Geri yükleme yeni kopyalar ekler; dört IndexedDB deposu tek işlemde yazılır. Kimlikli medya referansları yeni kopyalara bağlanır. SHA-256 bir kaynak doğrulama imzası değildir.
- **Sürümler**: otomatik sürümler en az 30 saniye aralıkla; elle anlık kayıt; kelime farkı ve önizleme; geri yüklemeden önce mevcut içerik korunur. Belge başına 30 sürüm / yaklaşık 20 MB; son sürüm daima saklanır.
- Boş paragrafta **/**: arama, ok tuşları, Enter, Escape. `#`, `##`, `###`, `-`, `*`, `1.`, `>`, üç ters tırnak ve `---` ardından boşluk blok oluşturur. HTTP bağlantıları yazım/yapıştırmada otomatik bağlanır; kod ve düz metin yapıştırma korunur.
- Seçili bloğun solundaki tutamakla **sürükleme**; yukarı/aşağı düğmeleri veya tutamakta ok tuşlarıyla taşıma. Bırakma çizgisi hedefi gösterir, Escape iptal eder, işlem tek undo'dur. İç içe öğeler üst blokla birlikte taşınır; tablo/resim araçları açıkken bu tutamak gizlenir.
- **Öneriler**: seçili metne alternatif veya silme önerisi; kabul, ret ve undo. Kaynak bölüm değişirse eski öneri kabul edilemez. Bu sürüm tüm yazım/biçim/yapı işlemlerini otomatik izleyen Track Changes modu sağlamaz.
- **Resim editörü**: PNG/JPEG/WebP, JPEG/WebP kalitesi; son piksel işlemleri ve kodlama Worker'da. Worker desteklenmezse ana iş parçacığı alternatifi. CSP `worker-src blob:` politikasına izin vermelidir. Boyut sınırı 16 MP / 8192 piksel.
- **Dosya → Sayfa düzeni ve dışa aktarım**: A4/Letter, yön, kenarlar, üst/altbilgi, tarayıcı yazdırma/PDF ve DOCX indirme. DOCX gerçek OOXML tablo/listeler/görseller içerir. Özel CSS'in tamamını, gömülü fontları veya videoyu taşımaz; Word görünüm eşitliği ve DOCX içe aktarımı henüz sağlanmaz. Harici görsel CORS nedeniyle okunamazsa dışa aktarım hata verir.

## Şema ve eklentiler

`getDocument()` ve `transaction` sürüm 1 HTML sözleşmesi korunur. Yeni `getModel()` sürüm 2 JSON ağacı döndürür. `setModel(model)` mevcut editöre yükler; `applyOperations({baseRevision, operations})` saf modelde doğrular ve tek undo işlemi uygular. Revizyon editör oturumuna aittir; ithal edilen modelin revizyon sayısı editörü geriye taşımaz. `replaceText`, `setAttributes`, `insertBlock`, `removeBlock`, `moveBlock` işlemleri vardır. Model sınırlı HTML şemasıdır; desteklenmeyen düğümler açık hata verir. DOM düzenleme yollarının tamamı henüz anlamsal işlem üretmez.

```js
const remove = editor.registerPlugin({
  id: 'my-tools',
  commands: [
    {
      id: 'signature',
      title: 'İmza',
      execute: (api) => api.insertHTML('<p>Saygılarımla</p>'),
    },
  ],
})
editor.executeCommand('my-tools/signature')
remove()
```

Eklentiler uygulayıcının güvendiği JavaScript'tir; güvenilmeyen kod için sandbox değildir. Komutlar salt okunur/devre dışı örnekte çalışmaz. `createDocumentSession(adapter)` yükleme/kayıt kuyruğunu yönetir; sağlayıcı `expectedVersion` koşulunu sunucuda atomik denetlemelidir. Çakışma hatasında yerel taslak korunur.

## Medya sağlayıcısı

`createHttpMediaAdapter({baseUrl, getToken})` paket dışındaki `examples/media-server.mjs` ile kullanılabilir. Sunucu PNG/JPEG/GIF/WebP imzalarını ve 12 MB sınırını denetler; dosya/metaveriyi diske yazar. Bearer token en az 32 karakterdir ve `STUDIO_MEDIA_TOKEN` ortam değişkeninden gelir. Sunucu varsayılan olarak yalnızca 127.0.0.1:8787'ye bağlanır. `STUDIO_MEDIA_DIRECTORY`, `STUDIO_MEDIA_ORIGIN`, `STUDIO_MEDIA_PUBLIC_URL` ayarlanabilir.

```powershell
# Token'ı güvenli ortamınızda tanımladıktan sonra:
node examples/media-server.mjs
```

Kalıcı `data-studio-asset` kimliği içerikte saklanır. `editor.refreshMedia()` sağlayıcının `resolve(id)` işlevinden yeni imzalı URL alır; belge arada değişmişse geç gelen sonuç uygulanmaz. URL yenileme zamanlaması uygulayıcıya aittir. Referans sunucu tek depolama alanı içindir; üretimde hesap ayrımı, kota, tarama, TLS ve işletim yedekleri ayrıca gerekir.

## Deneysel iş birliği

Yjs 13.6.33 isteğe bağlı yüklenir. `loadCollaboration()`; `createSharedDocument`, `bindSharedDocument`, `persistSharedDocument`, `openSharedRoom`, `connectSharedRoom` sağlar. İki editör örneği tüketici sayfasında **İki editörü eşleştir** ile denenebilir; bağlantı kesilip iki tarafta yazıldıktan sonra birleştirilebilir. Yerel undo eş kullanıcının metnini geri almaz.

Bir odanın ilk modelini yalnızca sunucu oluşturmalıdır. `openSharedRoom` PUT işlemi mevcut odayı ezmez; istemciler aynı ikili başlangıçtan açılır. Sonra editörü `bindSharedDocument` ile bağlayın ve bütün ağ güncellemelerini binding'in `receive` yolundan geçirin; IME sırasında gelenler kompozisyon sonuna kadar bekletilir. Bağlantıyı ve binding'i component kaldırılırken `dispose()` ile kapatın. IndexedDB sağlayıcısının `whenSynced` sonucunu bağlanmadan önce bekleyin. İlk oda açılışı bağlantı ister; önceki çevrimdışı veriyi geri açma akışını uygulayıcı yönetir.

`examples/collaboration-server.mjs` disk kalıcılığı, oda izinleri, editör/izleyici rolleri ve son 15 saniyedeki kullanıcı varlığını sağlar. `STUDIO_COLLAB_USERS`, `token`, `id`, `name`, `role`, `rooms` alanlarını içeren JSON dizisidir; gerçek sırları dosyaya/depoya koymayın. `STUDIO_COLLAB_DIRECTORY` ve `STUDIO_COLLAB_ORIGIN` ayarlanabilir. Varsayılan adres 127.0.0.1:8788. Sağlayıcı HTTP ile saniyede bir eşitler; WebSocket taşıyıcısı değildir. `onRole` ile Vue readonly prop'unu güncelleyin; asıl yazma iznini her istekte sunucu doğrular. Yetki iptalinde yerel taslak dışa aktarılabilmelidir.

**Sınır:** metin birleştirme ve yerel undo doğrulanmıştır. Eş zamanlı blok taşıma/silme, iç içe biçim değişimleri, karmaşık tablo yapıları, gerçek IME/telefon ve uzun süreli çok kullanıcılı oturumlar henüz üretim kabulünden geçmedi. Bu mod deneysel kalmalıdır. Tam kullanıcı yönetimi ve canlı imleçler sağlanmaz.

Kaynaklar: [Yjs güncellemeleri](https://docs.yjs.dev/api/document-updates), [editör binding'leri](https://docs.yjs.dev/ecosystem/editor-bindings), [IndexedDB sağlayıcısı](https://docs.yjs.dev/ecosystem/database-provider/y-indexeddb).

## Ölçüm

`workspace-performance-before.json` ve `workspace-performance-after.json`, aynı makinede tam web çalışma alanını ölçer. 100×20 tabloda hücre geometrisi okumaları yaklaşık %99 azalır. WebKit 10.000 paragraf seçim p95 225→47 ms; giriş p95 71→55 ms. İki çizim karesine dayanan sentetik ölçümdür, fiziksel klavye gecikmesi veya başka editörle kıyas değildir. Ölçüm performans değişikliği sonrası, sonraki yeni özellikler eklenmeden önce alınmıştır.

Tüm beta.10 eklerinden sonra aynı yöntemle alınan `workspace-performance-beta10.json`:

| Tarayıcı     | 10.000 paragraf giriş p95 | Seçim p95 | 100×20 tablo giriş p95 | Seçim p95 |
| ------------ | ------------------------: | --------: | ---------------------: | --------: |
| Chromium 153 |                   46,2 ms |   27,7 ms |                32,2 ms |   29,5 ms |
| Firefox 155  |                     38 ms |     11 ms |                  18 ms |     14 ms |
| WebKit 26.6  |                     60 ms |     48 ms |                  47 ms |     52 ms |

AMD Ryzen 9 7900 üzerinde başsız tarayıcı ölçümüdür. Aynı makinede başka test
çalıştırılmadı; giriş ölçümü `insertText` kullanır, donanım klavye `keyup` yolunu
ve gerçek ekran gecikmesini kapsamaz. WebKit'in büyük belge giriş p95'i 50 ms
hedefinin üzerindedir. Sonuçlar tek koşudan alınmıştır; rakip kıyaslaması değildir.
