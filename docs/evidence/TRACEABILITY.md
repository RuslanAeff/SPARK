# SPARK Akademik İzlenebilirlik Kaydı

## 1. Amaç ve kapsam

Bu belge, SPARK'ın geliştirme sürecinde bir gereksinimin hangi karara, kod
değişikliğine ve doğrulama kanıtına bağlandığını göstermeyi amaçlar. Tez veya
diploma çalışmasında kullanılacak iddialar için bir indeks görevi görür; tek
başına test raporu, kullanıcı onayı veya bağımsız doğrulama değildir.

`DESIGN_BRIEF.md` yaşayan ürün ve UX kaynağıdır; teknik mimari
`docs/ARCHITECTURE.md` ve ilgili ADR'lerde tutulur. Geçmiş bir iddia yalnız bu
belgelerden birinde yazdığı için doğrulanmış sayılmaz. Her iddia mümkün olduğunda
sabit bir Git commit'ine ve yeniden üretilebilir kanıta bağlanmalıdır.

## 2. Sorumluluk ve onay ilkesi

- Ürün amacı, kabul kriteri ve nihai karar insana aittir.
- Yapay zekâ analiz, öneri, kod ve test taslağı üretebilir; bunlar açık insan
  onayı veya bağımsız doğrulama olmadan insan kararı olarak sunulamaz.
- “Uygulandı”, “test edildi”, “cihazda doğrulandı” ve “yayımlandı” ayrı
  durumlardır. Biri diğerini ima etmez.
- AI tarafından yazılan kayıt, AI katkısı alanında açıkça belirtilir.
- İnsan onayı için tarih, onayın kapsamı ve mümkünse konuşma/issue/commit
  referansı kaydedilir. Sadece “onaylandı” yazmak yeterli değildir.

## 3. Kanıt düzeyleri

| Kod | Anlam | Asgari kanıt |
|---|---|---|
| `E0` | İddia veya retrospektif anlatı | Kaynak belge ve sınırlama notu |
| `E1` | Depoda gözlemlenen uygulama | Commit hash + dosya/satır veya diff |
| `E2` | Otomatik doğrulama | Commit hash + tam komut + tarihli sonuç/CI bağlantısı |
| `E3` | Hedef cihazda doğrulama | Build kimliği + cihaz/OS + senaryo + sonuç + artefakt |
| `E4` | İnsan kabulü veya sürüm kanıtı | Açık kabul kaydı ve/veya yayımlanmış sürüm kimliği |

Bir kaydın kanıt düzeyi, sahip olduğu en yüksek numara değil, iddiayı gerçekten
destekleyen düzeydir. Örneğin typecheck başarısı görsel flicker'ın düzeldiğini
kanıtlamaz; bu iddia için `E3` gerekir.

## 4. Durum sözlüğü

`Önerildi` → `İnsan tarafından onaylandı` → `Uygulandı` → `Otomatik doğrulandı`
→ `Cihazda doğrulandı` → `Kabul edildi` → `Yayımlandı`

Bir kayıt birden fazla durumu ayrı tarihlerde taşıyabilir. “Retrospektif” etiketi,
olay sırasında tutulmayan ve daha sonra Git/dokümanlardan yeniden kurulan bilgiyi
gösterir.

## 5. SPARK gereksinim–kanıt matrisi

Aşağıdaki başlangıç satırları mevcut Git geçmişi ve `DESIGN_BRIEF.md` üzerinden
retrospektif olarak çıkarılmıştır. Bunlar bağımsız doğrulama değildir; boş kanıt
alanları tamamlanmadan akademik sonuç iddiasında kullanılmamalıdır.

| Kimlik | Gereksinim / problem | Karar veya sözleşme | Uygulama referansı | Doğrulama referansı | İnsan/cihaz kabulü | Düzey | Retrospektif sınırlama |
|---|---|---|---|---|---|---|---|
| `SPK-DOM-001` | Analiz projeksiyonu Dashboard ile aynı bütçe dönemini kullanmalı | Takvim ayı yerine bütçe döngüsü ve `effectiveBudget` esas alınır | Commit `5248b98`; `app/(tabs)/analytics.tsx`, `src/utils/spendingProjection.ts` | `src/utils/__tests__/spendingProjection.test.ts`; tarihli komut çıktısı eklenecek | Cihaz kaydı eklenecek | `E1` | Kayıt olaydan sonra commit ve rehberden çıkarıldı |
| `SPK-REL-001` | Temiz kurulumda DB seed ve eşzamanlı okuma çakışmamalı | DB tüketicileri seed tamamlanana kadar ortak init promise'ini bekler | Commit `5865af8`; `src/db/database.ts` | Temiz-kurulum otomasyonu veya logu eklenecek | Cihaz/build kaydı eklenecek | `E1` | Kök neden açıklaması `DESIGN_BRIEF.md` P28'e dayanır |
| `SPK-I18N-001` | AZ/RU çevirileri derlemede kaybolmamalı | Üretilmiş locale dosyaları doğrudan düzenlenmez; `map-*` + derleme + parity testi kullanılır | `src/i18n/compilePartial.mjs`, `src/i18n/buildLocales.mjs` | `src/i18n/__tests__/localeParity.test.ts`; CI bağlantısı eklenecek | İnsan dil kontrolü ayrı kaydedilecek | `E1` | Geçmişteki sessiz kayıp rehberde retrospektif anlatılmıştır |
| `SPK-UX-001` | Soğuk açılışta tema/yüzey flicker'ı olmamalı | Native splash ve JS boot yüzeyi tek gate; uygulama teması React store üzerinden uygulanır | Mevcut çalışma ağacı; commit hash henüz kaydedilmedi | İlgili unit test ve typecheck sonucu eklenecek | APK, cihaz/OS ve video-kare incelemesi zorunlu | `E0` | Commit ve cihaz kanıtı yokken “çözüldü” denemez |
| `SPK-NOTIF-001` | Bildirimler güvenli tekli ve toplu silinebilmeli | Swipe yalnız sil aksiyonunu açar; uzun basma seçim modudur; toplu DB mutasyonu atomiktir | Mevcut çalışma ağacı; `app/notifications.tsx`, `src/notifications/storage.ts` | Test dosyaları ve tam sonuç eklenecek | Gerçek cihaz gesture testi eklenecek | `E0` | Bu kayıt mevcut kodu işaretler; commit/CI/cihaz kabulü bekleniyor |
| `SPK-DOC-001` | Proje bilgisi yaşayan rehber, tarihçe ve tez kanıtı olarak ayrılmalı | Tek-kaynak sahipliği; ürün, mimari, ADR, tarihçe ve evidence belgeleri farklı sorumluluk taşır | Mevcut çalışma ağacı; `DESIGN_BRIEF.md`, `AGENTS.md`, `docs/` | `AI-2026-08-01-DOCS-001`: legacy SHA-256, 20 Markdown dosyasında 0 kırık göreli bağlantı, temiz `git diff --check`, typecheck ve 30/30 Jest suite | İnsan belge incelemesi bekleniyor | `E0` | Doğrulama kirli ve commit'e bağlanmamış çalışma ağacında yapıldı; ürün testleri belge içeriğinin akademik doğruluğunu kanıtlamaz |

## 6. Yeni izlenebilirlik kaydı şablonu

Her yeni özellik, hata düzeltmesi veya araştırma için aşağıdaki blok kopyalanır.

### `<KAYIT-KİMLİĞİ>` — `<kısa başlık>`

| Alan | Kayıt |
|---|---|
| Tarih ve saat dilimi | `<YYYY-AA-GG, Europe/Warsaw>` |
| Kaydı açan | `<insan / issue / gözlem>` |
| İnsan tarafından onaylanan kapsam | `<onaylanan davranış ve sınırlar>` |
| Gereksinim | `<ölçülebilir kullanıcı/teknik gereksinim>` |
| Kabul kriterleri | `<Given/When/Then veya madde listesi>` |
| Başlangıç durumu | `<yeniden üretim adımları ve gözlenen sonuç>` |
| Karar/ADR | `<ADR kimliği veya gerekçeli karar>` |
| AI katkısı | `<analiz/kod/test/doküman; araç/model kaydı referansı>` |
| İnsan katkısı | `<gereksinim, seçim, inceleme, manuel test>` |
| Uygulama | `<commit hash ve dosyalar>` |
| Otomatik doğrulama | `<tam komut, exit code, tarih, log/CI URI>` |
| Cihaz doğrulaması | `<build, cihaz, OS, senaryo, sonuç, ekran/video URI>` |
| Nihai insan kabulü | `<kim, tarih, kapsam, referans>` |
| Gizlilik kontrolü | `<temizlendi / redakte edildi / paylaşım kısıtı>` |
| Kalan risk | `<bilinen sınırlama ve takip işi>` |
| Kanıt düzeyi | `<E0–E4>` |
| Retrospektif sınırlama | `<olay sırasında tutulmayan/veri kaybı olan alanlar>` |

## 7. Doğrulama kanıtı biçimi

### Otomatik test kaydı

```text
Commit/build: <hash veya build kimliği>
Tarih/saat dilimi: <ISO-8601>
Ortam: <OS, Node, paket yöneticisi>
Komut: <tam ve yeniden çalıştırılabilir komut>
Exit code: <0/non-zero>
Özet: <suite/test sayısı, typecheck sonucu>
Artefakt: <CI URL veya depo içi log yolu>
Kapsamadığı iddialar: <ör. görsel kalite, gerçek cihaz gesture'ı>
```

### Cihaz doğrulama kaydı

```text
Build: <APK/IPA/EAS build kimliği ve commit>
Cihaz: <üretici/model; kişisel cihaz adı kullanmayın>
OS: <sürüm>
Uygulama modu: <release/development/Expo Go>
Ön koşullar: <tema, dil, DB durumu, ağ>
Adımlar: <numaralı senaryo>
Beklenen: <ölçülebilir sonuç>
Gözlenen: <sonuç>
Artefakt: <redakte edilmiş video/screenshot/log>
İnceleyen ve tarih: <insan>
```

## 8. Gizlilik ve araştırma etiği

- Gemini API anahtarı, token, EAS secret, credential, cihaz UUID'si, mutlak kullanıcı
  yolu ve kişisel finans verisi bu kayda yazılmaz.
- Ekran görüntülerinde bildirim çubuğu, kişi/satıcı isimleri, tutarlar ve dosya
  yolları paylaşım amacına göre redakte edilir.
- Konuşma dökümünün tamamı yerine kararın özeti ve kontrollü referansı tutulur.
- Tez ekine girecek AI çıktıları insan tarafından doğrulanır; hatalı veya reddedilen
  öneriler de seçici biçimde silinmek yerine sonuçlarıyla kaydedilir.
- Hash kullanılıyorsa neyin hash'lendiği, algoritma ve oluşturma tarihi belirtilir;
  hash, içeriğin doğruluğunu değil yalnız bütünlüğünü destekler.

## 9. Retrospektif kayıt sınırlaması

Geçmiş commitlerden sonradan oluşturulan kayıtlar şu riskleri açıkça taşımalıdır:

- O sırada değerlendirilen fakat kayda geçmeyen alternatifler bilinmeyebilir.
- Commit mesajı insan niyetini eksik veya hatalı özetleyebilir.
- Daha sonra güncellenen `DESIGN_BRIEF.md`, olay anındaki bilgiyi yansıtmayabilir.
- Test dosyasının varlığı, testin ilgili committe gerçekten çalıştırıldığını göstermez.
- Bugünkü cihaz sonucu, geçmiş build'in davranışının kanıtı değildir.

Bu nedenle retrospektif satırlar `E0` veya `E1` ile başlatılır; tarihli CI, cihaz ve
insan kabul kanıtı bulunmadıkça daha yüksek düzeye çıkarılmaz.
