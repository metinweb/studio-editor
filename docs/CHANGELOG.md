# Changelog

## September 28, 2026 — Writing power tools

- Added previewed Markdown file/text import and copy/download export, with GFM tables, checklists and fenced code. Complex tables and special Studio widgets use sanitized HTML islands.
- Added opt-in exact autocorrection rules, multiline text shortcuts and smart symbols with separate undo.
- Added a configurable permanent pen with grouped typing history, caret-following formatting and Escape exit. Settings are per editor session; code, links, protected content, paste and IME are excluded.
- Added English/Turkish dialogs, mobile layouts, boundary validation and cross-browser coverage.

## Unreleased — Document tools and reference audit

- Local DOCX import with preview, conversion notes, embedded raster images, sanitization, bounded ZIP preflight and one-step undo. Mammoth is lazy-loaded and its BSD-2-Clause notices are bundled.
- Anchors with a link target picker, automatic footnote numbering/editing/removal, and merge fields with safe value substitution. DOCX export now produces real footnotes and internal bookmarks.
- Desktop flyout menus, mobile submenu back navigation, a selection toolbar, view-only block/whitespace guides, zoom and detailed document/selection counts.
- Custom font sizes, H5/H6, paragraph indentation, title/sentence case and typography cleanup. Upper/lower case now follows the editor locale.
- Added a capability-by-capability [TinyMCE comparison](TINYMCE-COMPARISON.md) identifying remaining gaps rather than claiming full premium parity.

## Unreleased — Menus, list galleries and writing tools

- Split buttons for bullet and numbered lists with nine visual style choices, start/reverse numbering and removal. Nested lists and split segments preserve styling and numbering.
- Grouped menus with submenus, keyboard navigation, mobile back navigation, command search and a Help menu. English and Turkish labels follow the editor instance.
- Added line spacing, paragraph direction, special characters/emoji, date/time, nonbreaking spaces and page breaks. Commands preserve the document selection and participate in undo/redo.
- DOCX output preserves letter/Roman numbering, bullet shapes, reversed numbering, line spacing and page breaks. Print output avoids duplicate breaks.
- Fixed list commands doing nothing when Chromium/WebKit places a caret at the document boundary after a whitespace click.

## Unreleased — Protected rings and text to structure

- Ring corners now move the connected structure rigidly, including drag, keyboard and numeric coordinate edits. Protection derives from bond connectivity and applies to existing saved drawings and fused rings.
- Tidy structure repairs distorted geometry with a fresh 2D layout; changes remain undoable.
- From text converts common names/condensed formulas and SMILES into editable molecules. Molecular formulas offer explicit common-structure choices instead of guessing connectivity.
- Lazy-loaded OpenChemLib validates SMILES and computes coordinates locally. Unsupported chemical annotations and invalid input leave the current drawing intact. Distribution includes its BSD-3-Clause license.

## Unreleased — Direct molecule manipulation

- Drag atoms and ring cards from the palette onto the canvas, with placement previews and touch support.
- Move is now the default: drag individual atoms or grab a bond to move its entire connected molecule. Selected atoms expose a + handle for drawing a branch.
- Labeled drawing tools, visible carbon handles and a mobile ring tray above the canvas.
- Cancelled/outside drops preserve the drawing; dragging out of a dialog no longer closes it accidentally. Normal backdrop clicks still close dialogs.

## Unreleased — Molecule drawing workspace

- Rebuilt the sketcher around a drawing canvas, element palette, icon tools and a stable atom inspector.
- Drag from empty space to create a bond, extend chains from existing atoms, and snap onto existing endpoints. Bonds use fixed lengths and 30° angles; Alt allows free drawing.
- Place five/six-membered rings and benzene rings, with inward-facing double bonds.
- Optional skeletal carbon notation, colored elements, clipped bond endpoints and matching document exports. Existing diagrams remain editable.
- Gesture-level undo/redo, Escape to cancel a move, arrow-key positioning, element and bond keyboard shortcuts, and compact output preview.

## Unreleased — Math and chemistry

- Lazy-loaded Math & chemistry dialog from the Insert menu, toolbar and `/science` command.
- LaTeX equations and mhchem chemical formulas, reaction arrows, and single/double/triple bond notation, rendered locally with MathJax 4.
- Molecule sketcher with atom placement, movement, editable elements, three bond orders, deletion, drawing undo/redo, and water/ethanol/benzene presets.
- Source metadata retained with self-contained PNG images for reopening, document undo/redo, autosave, backups and HTML export; Word/PDF preserve the visual image.
- English/Turkish interface, accessible descriptions and keyboard-accessible atom properties.
- Vue component `openScience()` API and `studio/science` plugin command.
- Dependency distribution includes MathJax and font license notices. The project remains MIT licensed.

See [Math and chemistry](SCIENCE.md) for examples and current limits.

## Unreleased — English-first experience

- English is now the default for the public website, workspace and Vue component.
- Persistent English/Türkçe selection preserves document content and undo history.
- English welcome content, built-in templates, workspace dialogs and table/image controls.
- English component API and localization guide; Turkish website retained under `/tr/`.
- Locale-aware search and date formatting, with document language retained in backups.
- Existing component integrations can keep Turkish by explicitly passing `locale="tr"`.

Earlier release notes below are in Turkish.

## 0.1.0-beta.11 — 25 Eylül 2026

- MIT lisansı, herkese açık GitHub deposu ve katkı/güvenlik rehberleri.
- Türkçe tanıtım sayfası, çalışan demo ve testlerden sonra GitHub Pages yayını.
- Günlük yazma araçları, medya gömme, favoriler, etiketler ve belge araması güncel dağıtıma dahil edildi.
- İngilizce ana README ve Türkçe ayrıntılı belge.
- Lisans metinleri ve üçüncü taraf bildirimleri web/Vue dağıtımlarına dahil edilir. npm yayımı yapılmadı.

## Geliştirme sürümü — 25 Eylül 2026

- Belge favorileri ve yalnız favorileri gösteren liste.
- Otomatik kaydedilen etiketler; Türkçe yinelenen etiket denetimi ve etiket filtresi.
- Başlık, etiket ve belge metninde birleşik arama; içerik değişimine göre yenilenen metin önbelleği.
- Tarih ve Türkçe doğal başlık sıralaması; filtreleri temizleme ve sonuç sayacı.
- Tam yedeklerde favori/etiket koruması, eski yedek uyumluluğu ve mobil etiket penceresi.

[Kullanım ve saklama sözleşmesi](DOCUMENT-LIBRARY.md). Dağıtım arşivleri yeniden paketlenmedi.

## 0.1.0-beta.10 — 24 Eylül 2026

- Tam çalışma alanı yedeği, doğrulanmış atomik geri yükleme ve medya kimliği eşlemesi.
- IndexedDB üzerinde kalıcı sürümler, elle kayıt, metin farkı ve güvenli geri yükleme.
- Slash komut menüsü, Markdown kısayolları, otomatik bağlantılar; blokları sürükleme ve klavyeyle taşıma.
- JSON belge şeması 2, anlamsal işlem API'si, revizyon denetimi ve kalıcı üst blok kimlikleri.
- Office sınıf/miras stilleri, harf ve Romen listeleri; RTL sütun boyutlandırma ve genişleyen İngilizce paneller.
- WebP/kalite, pakete gömülü resim Worker'ı, kalıcı asset referansları ve imzalı URL yenileme.
- HTTP medya adaptörü ve kimlik doğrulamalı disk sunucusu örneği.
- İsim alanlı eklenti/komut kaydı ve iyimser kilitlemeli belge depolama sözleşmesi.
- Seçili metin önerileri, kabul/ret, eski öneri koruması ve undo. Tam otomatik Track Changes değildir.
- Deneysel Yjs editör bağlayıcısı, çevrimdışı metin birleşimi, kullanıcıya ait undo, IndexedDB kalıcılığı.
- Yetkili oda/presence/disk sunucusu ve HTTP eşitleme adaptörü; yapısal eş zamanlı düzenleme üretim kabulünden geçmemiştir.
- Sayfa düzeni, yazdırma/PDF ve gerçek OOXML DOCX dışa aktarımı.
- Büyük tablolarda gereksiz geometri okumalarının azaltılması; üç tarayıcı ölçüm kaydı.
- Çoklu editörde uzaktan güncellemenin odağı çalması, Firefox sağ tık hedefi ve WebKit blok aracı yenileme düzeltmeleri.

[Kullanım, API ve kapsam sınırları](BETA10.md).

## 0.1.0-beta.9 — 24 Eylül 2026

- Tablo yapıştırmada hedef/kaynak hücre biçimi seçimi; Türkçe/İngilizce menü.
- Dinamik tablePasteStyle prop'u, v-model olayı ve TypeScript tipi.
- Açık hücre renkleri, tipografi, hizalama, padding ve ayrı kenar stilleri;
  eski bgcolor/align/valign özniteliklerinin CSS'e dönüşümü.
- Kaynak ölçü/konum/URL/değişken/öncelik aktarımını sınırlama; hedef kimlik,
  başlık türü ve genişliğini koruma; clean/text/TSV'de hedef biçimi.
- CSS kenar/padding alt özelliklerinin pano temizliğinde korunması, tek undo
  ve çoklu editör/menü/prop entegrasyon testleri.

## 0.1.0-beta.8 — 24 Eylül 2026

- HTML matrisinde yatay/dikey birleşimleri mevcut tabloya taşıma; normal
  matrisle tamamen kapsanan birleşik hedefi ayırma.
- Hedef sınırında kısmi birleşim, tablo bölümünü aşan rowspan, taşma, hatalı
  kaynak ve seçim boyutu uyuşmazlığını mutasyon öncesinde reddetme.
- Tek değerle aktif/seçili birleşik hücreleri yapıyı koruyarak doldurma.
- Kaynak rowspan=0 normalizasyonu, hedef dışı span koruması ve mantıksal
  paste.rows/columns metaverisi; mevcut pasteCells işlem sözleşmesi ve tek undo.
- Koordinat planlayıcı testleri, HTML/TSV dönüşü ve keep/clean/text paket testleri.

## 0.1.0-beta.7 — 24 Eylül 2026

- Seçili hücrelerde toplu dolgu/metin rengi, yatay/dikey hizalama, iç boşluk.
- Birleşik hücre koordinatlarına göre tüm/dış/iç kenarlar, kenarlığı kaldırma
  ve varsayılana döndürme; kalınlık, renk ve çizgi türü.
- Türkçe/İngilizce hücre biçimi penceresi, örnek görünüm, karışık değerler,
  yalnızca değişen alanların uygulanması ve içerikten bağımsız biçim sıfırlama.
- Tablo menüsü, sağ tık ve hızlı araçlardan erişim; tek formatCells işlemi ve undo.
- Belge revizyonu değişmişse eski taslağı reddetme; readonly geçişinde iptal.

## 0.1.0-beta.6 — 24 Eylül 2026

- Seçili dikdörtgeni, hizalı sağ/alt komşuyu birleştirme; yatay/dikey ayırma.
- Birleşik tablolarda satır/sütun ekleme-silme; span ayarı, kalan birleşik
  hücrede içerik koruma, tablo bölümleri ve son satır/sütun davranışı.
- Tam birleşik tablonun sonundaki Tab ile yeni düzenlenebilir satır ekleme.
- Tablo, sağ tık ve hızlı araç menülerinin yeni yeteneklere bağlanması.
- Yapısal tablo işlemlerinin planlama/uygulama modüllerinde toplanması;
  eski motor/özellik dosyalarındaki tekrarlanan kodun kaldırılması.
- Boyut sınırları, rowspan=0, matris bütünlüğü, tek undo ve paket testleri.

## 0.1.0-beta.5 — 24 Eylül 2026

- Rowspan/colspan koordinat matrisi ve birleşik hücreleri bütünüyle kapsayan
  dikdörtgen seçim; sürükleme, Shift+tık ve Alt+Shift+ok desteği.
- Seçili hücreleri HTML/TSV olarak kopyalama, kesme/temizleme ve tek undo.
- Mevcut tabloya matris yapıştırma; boyut/taşma/birleşik hedef durumlarında
  içeriği değiştirmeden uyarı; tek değeri seçime dağıtma.
- Komşu sütunları dengeleyen sınır tutamaçları; klavye, Esc/readonly iptali,
  kalıcı colgroup genişlikleri, undo ve sonraki sütun ekleme/silme uyumu.
- DOM'dan bağımsız matris testleri ve üç tarayıcıda web/paket senaryoları.

## 0.1.0-beta.4 — 24 Eylül 2026

- Word listeleri, Excel/Sheets tırnaklı TSV ve Google Docs sarmalayıcı temizliği.
- Yapıştırma için koru/temizle/metin menüsü, Vue seçenekleri ve metaveri olayı.
- Metin+görselin tek işlemde eklenmesi, yerel görsel eşleme, mükerrer görselin
  önlenmesi ve pano boyut sınırları.
- Yükleme sürerken değişen belgeye eski seçimin uygulanmaması.
- Üç tarayıcı, kurulmuş npm paketi ve TSV ayrıştırıcısı için testler.
- Gerçek Chromium açılış/undo/giriş/heap benchmark'ı ve ölçüm sınırları.

## 0.1.0-beta.3 — 24 Eylül 2026

- Dinamik `readonly` ve `disabled`: motor, klavye, yapıştırma, drop, geçmiş,
  kaynak görünümü ve geç gelen yüklemeler için tutarlı düzenleme kuralları.
- Salt okunur içerikte WebKit Backspace'in sayfadan geri gitmesini engelleme.
- Belge HTML'ine karışmayan boş içerik ipucu (`placeholder`).
- Araç çubuğu grupları ve üst menülerin bileşen seçenekleriyle yapılandırılması.
- Çekirdek arayüz için Türkçe/İngilizce ve editöre özel `messages` sözlüğü;
  gelişmiş panellerin tam çevirisi ve RTL bu sürümde yoktur.
- Tüketici örneğinde çalışma sırasında mod, dil ve görünür araç değiştirme.
- TypeScript seçenekleri ve üç motorda entegrasyon testleri.
- Proje klasörü kullanıcı tarafından `C:\htdocs\studio` olarak yeniden adlandırıldı.

## 0.1.0-beta.2 — 24 Eylül 2026

- Tam HTML geçmiş kayıtları yerine geri alınabilir HTML ve blok kimliği farkları.
  Bitişik yazım gruplama, redo dalları ve geçmiş boyut sınırı korunur.
- Oturum içi blok UUID'leri; seçim yer imleri ve metin konumu eşleme yardımcıları.
  Kimlikler belge HTML'ine yazılmaz.
- `transaction` olayı; `getDocument`, `getHistoryStats`, `mapSelection`,
  `mapOffset` API'leri ve TypeScript tanımları.
- Editör örneğine özel `mediaAdapter`: listeleme, yükleme, alt metin güncelleme,
  silme; ilerleme, iptal ve başarısız yüklemeyi tekrar deneme.
- Sağlayıcı sonucunda URL/kayıt doğrulaması; iptal/unmount sonrası geç yükleme
  sonucunu atma. Uzak URL ile görsel düzenleme çıktısını belgeye uygulama.
- Kelime ve karakter hesabında ortak metin sonucu; büyük belge geçmiş benchmark'ı.
- Gerçek npm tarball tüketicisinde mimari ve medya entegrasyon testleri.
- HTTP medya adaptörü örneği ve mimari sözleşme belgesi.

Varsayılan web uygulaması yerel IndexedDB kullanmaya devam eder. Sunucu uygulaması,
CRDT/ortak düzenleme, değişiklik izleme ve kalıcı belge kimlikleri bu sürüme dahil
değildir. Lisans seçimi beklenmektedir; bu sürüm yalnızca yerel paketlenmiştir.

## 0.1.0-beta.1 — 24 Eylül 2026

- Bağımsız web uygulaması ve Vue/Pinia bileşeni için ayrı dağıtımlar.
- ESM, TypeScript bildirimleri, kapsamlı CSS ve tüketici örneği.
- TinyMCE vendor dosyalarının proje dışına taşınması.
- ZIP/tarball, SHA-256 manifest, üçüncü taraf lisansları ve tüketici doğrulaması.
