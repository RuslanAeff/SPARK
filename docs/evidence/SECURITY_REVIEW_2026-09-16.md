# Google Play öncesi güvenlik incelemesi

> Güncel düzeltme durumu: [16 Eylül düzeltme ve regresyon kaydı](SECURITY_REMEDIATION_2026-09-16.md).
> Aşağıdaki inceleme ilk HEAD snapshot’ını anlatır. Sonraki kod düzeltmeleri yayın
> onayı değildir; cihazda doğrulanmayan hiçbir bulgu kapalı sayılmadı.

## Sonuç ve kapsam

**Karar: Bu sürüme henüz yayın için güvenlik onayı verilmemeli.** Önce aşağıdaki
gizlilik ve veri sınırı bulguları giderilmeli; ardından gerçek release paketiyle
native kontroller tamamlanmalı. Kaynak kod incelemesi ve geçen testler tek başına
mağaza yayınına uygunluk kanıtı değildir.

- İncelenen temel: `25ef86c`, `main`, SPARK `3.3.0`; başlangıç ağacı temiz.
- İnceleme oturumu: 15–16 Eylül 2026, Europe/Warsaw; rapor tamamlanma tarihi 16 Eylül.
- İnsan talebi: güvenlik incelemesi, rapor ve başka AI için uygulanabilir düzeltme ipuçları.
- Yöntem: kaynak/config ve kurulu SDK incelemesi, üç paralel kapsam incelemesi,
  sentetik hata enjeksiyonu, mevcut testler, npm güvenlik veritabanı ve resmi belgeler.
- Ürün kodu/config/bağımlılıklar değiştirilmedi. Rapor, sentetik inceleme araçları,
  kanıt kayıtları ve bir eski mimari açıklama güncellendi. Commit/push/yayın yapılmadı.
- Gerçek API anahtarı, kullanıcı fişi, finansal veritabanı veya EAS signing secret'ları
  okunmadı/gönderilmedi. Canlı servis saldırı testi yapılmadı.

**Önem ayrımı:** P1 = yayın öncesi çözüm/karar gerekli; P2 = orta risk, koşullu
güvenlik veya veri kontrolü kusuru; P3 = düşük risk/sağlamlaştırma. Bunlar CVSS
puanı değildir. npm'in `critical` etiketi ayrı bir bağımlılık kaydıdır; telefonda
kritik uzaktan kod çalıştırma kanıtı elde edilmedi.

## Öncelik tablosu

| Kimlik | Öncelik | Bulgu | Kanıt |
|---|---|---|---|
| SEC-04 | P1 / gizlilik | Gemini aktarım açıklaması ve gizlilik taahhütleri eksik/çelişkili | UI/kod + canlı politika + resmi kurallar |
| SEC-05 | P1 / değerlendirme | 32 bağımlılık uyarısı; çalışma zamanı/derleme ayrımı gerekiyor | Canlı npm audit + bağımlılık zinciri |
| SEC-01 | P2 | İçe aktarılan logo URI'si dış ağ isteğine dönüşebilir | Gerçek parser üzerinde sentetik probe + Image sink |
| SEC-02 | P2 | API anahtarı silinemediğinde başarı bildiriliyor | Gerçek servis üzerinde hata enjeksiyonu |
| SEC-03 | P2 | Finansal bildirim deposu Android yedek kapsamına giriyor | Expo introspection + native SDK/XML |
| SEC-06 | P2 | Yedek boyut sınırı sınırsız kopyalamadan sonra uygulanıyor | JS + Android document-picker kodu |
| SEC-07 | P3 | Geçici fiş/yedek dosyalarının saklama süresi yönetilmiyor | Kod + geç native sonuç probe'u |
| SEC-08 | P3 | Derin JSON sanitizer çağrı yığınını taşırabiliyor | Sentetik parser probe'u; UI hatayı yakalıyor |
| SEC-09 | P3 | Gereksiz overlay izni üretiliyor | Expo introspection; final manifest bekleniyor |
| REL-01 | Yayın engeli | Production profili AAB yerine APK üretiyor | `eas.json:18` |

## Bulgular ve düzeltme rehberi

### SEC-01 — Yedekten gelen görsel adresine güveniliyor

**Kanıt:** `src/services/backupService.ts:443` yalnız dize uzunluğu kontrol ediyor;
`:1342` adresi yeni satıcının `logo_uri` alanına yazıyor.
`src/components/VendorAvatar.tsx:30`, `src/components/VendorOptionsSheet.tsx:129`
ve `app/settings-data.tsx:466` URI'yi doğrudan `Image` kaynağı olarak kullanıyor.

Kullanıcı hazırlanmış bir JSON yedeği içe aktarırsa, logo alanındaki uzak izleme
adresi satıcı görüntülendiğinde yüklenebilir. IP/istek zamanı karşı sunucuya
gidebilir. Sentetik `https://example.invalid/unique-image.png` parser tarafından
kabul edildi; gerçek ağ isteği veya başka dosyaların sızması denenmedi.

**Düzeltme:** Yedek görüntü dosyası taşımadığı için dışarıdan gelen `logo_uri` ve
`receipt_uri` değerlerini taşınabilir kanıt sayma; restore sınırında temizle.
Var olan yerel satıcının kullanıcı tarafından seçilmiş logosunu koru. Render
katmanında da uygulamanın onayladığı görsel kaynaklarını doğrula. Sadece HTTPS
zorunluluğu koymak takip adresini engellemez.

**Kabul testi:** v1–v4 yedeklerde `http:`, `https:`, `file:`, `content:` adresleri
restore üzerinden Image'a ulaşmamalı; mevcut yerel logo korunmalı. Android'de
sentetik yedek ve kontrollü ağ kaydıyla ayrıca doğrula.

### SEC-02 — Başarısız anahtar silme işlemi gizleniyor

**Kanıt:** `src/services/secureKeyStore.ts:100` tüm `deleteItemAsync` hatalarını
yutuyor. `app/settings-ai.tsx:59` bunu başarı kabul edip `hasKey=false` yapıyor ve
silindi mesajı gösteriyor. Hata enjeksiyonunda fonksiyon başarılı tamamlandı,
anahtar taklit depoda kaldı ve tekrar okunabildi.

**Etki:** Yerel güvenli depolama hata verdiğinde kullanıcı anahtarı kaldırdığını
sanabilir; uygulama daha sonra anahtarı kullanabilir. Uzaktan anahtar çalma değildir.

**Düzeltme:** Silme hatasını üst katmana ilet; başarısızlıkta başarı toast'ı ve boş
anahtar durumu gösterme. Legacy SQLite anahtarının silinmesini ve migration ile
yarışmasını da sözleşmeye dahil et. Google tarafındaki anahtarı iptal etmek,
cihazdan silmekten ayrı bir işlemdir.

**Kabul testi:** Native silme hatası → servis reject, UI hata; başarılı silme →
anahtar yok; uygulama yeniden açılınca legacy kayıttan anahtar geri gelmiyor.
Servisi tamamen mock eden UI testine ek olarak gerçek servis mantığını test et.

### SEC-03 — Planlanmış bildirimler otomatik yedek kapsamına giriyor

**Kanıt zinciri:**

- `app.json:74` SecureStore plugin'i; Expo introspection'da `allowBackup=true`,
  `@xml/secure_store_backup_rules` ve `@xml/secure_store_data_extraction_rules`.
- Kurulu `expo-secure-store/android/src/main/res/xml/` kuralları tüm `sharedpref`
  alanını dahil ediyor; SecureStore'u hariç tutuyor. Cloud ve device-transfer aynı.
- Kurulu `expo-notifications` içindeki `SharedPreferencesNotificationsStore.kt:17`
  ve `:70`, bildirim isteğini `expo.modules.notifications.SharedPreferencesNotificationsStore`
  deposuna base64 olarak yazıyor. Base64 şifreleme değildir.
- `src/services/androidNotificationsSetup.ts:475` başlık/metni planlıyor;
  `src/notifications/reminderNotificationPresentation.ts:41` ve `:67` ödeme/karşı
  taraf/tutar bilgisi üretiyor.
- `privacy-policy.html:170` ve `:259` bu içeriğin cihazdan çıkmadığını söylüyor.

**Etki/sınır:** Sistem yedeği açık ve koşulları sağlanmışsa bu finansal içerik
hesap yedeğine veya başka cihaza taşınabilir. Statik olarak yedek kapsamı doğrulandı;
gerçek cihaz yedeği alınmadı. Mevcut include kuralları nedeniyle SQLite'ın tamamı
yedekleniyor sonucu çıkarılmadı. Android yedeğinin platform güvenlik korumaları
vardır; bulgu herkese açık veri sızıntısı iddiası değildir.

**Düzeltme:** Uygulamaya ait Expo config plugin/XML ile bildirim deposunu eski
full-backup ve Android 12+ cloud/device-transfer kapsamlarından çıkar. SecureStore
dışlamasını ve diğer veri sınırlarını koru; `node_modules` içine kalıcı düzeltme
yazma. `allowBackup=false` tek başına her üreticide cihaz aktarımını durdurmaz.
[Android Auto Backup kuralları](https://developer.android.com/identity/data/autobackup).

**Kabul testi:** Release paketindeki gerçek manifest/XML; sentetik bildirimle
yedek/geri yükleme ve reboot. Bildirim deposu geri gelmemeli; uygulamanın normal
yerel hatırlatma yeniden kurma akışı bozulmamalı.

### SEC-04 — Aktarım açıklamaları ve gizlilik metni tutarlı değil

**Kanıt:** `app/(tabs)/scanner.tsx:181` seçilen fişi Gemini'ye gönderiyor; normal
tarama açıklaması yalnız AI'nın ürünleri çıkaracağını söylüyor.
`app/product-matching.tsx:439` ve `:1029` ürün önerisi gönderiyor; bu eylem yanında
Google'a hangi verinin gideceği açıklanmıyor. Ayarlar'daki anahtar yardımı ücretsiz
AI Studio anahtarı öneriyor; fiş verisi için hizmet koşulu ayrımı yok.

Canlı gizlilik URL'si HTTP 200 verdi ve depodaki `privacy-policy.html` ile birebir
eşleşti. Dolayısıyla eski site sürümü bulgusu yok. Ancak `:153` / `:242` hiçbir
üçüncü tarafla paylaşım olmadığını söylerken `:142` / `:231` Google'a aktarımı
açıklıyor. `:140` / `:229` yalnız iki dış veri yolu derken aynı metin manuel yedek
paylaşımını da anlatıyor. SEC-01 ve SEC-03 de mutlak cihazda kalma iddiasını etkiliyor.

**Düzeltme:** Tarama ve ürün karşılaştırması sırasında veri türünü, Google Gemini'yi
ve amacı kısa ve görünür anlat; açıklama ardından açık kullanıcı eylemi olmadan
gönderme. Reddetme/geri tuşu ağ çağrısı yapmamalı, manuel kayıt kullanılabilmeli.
Gizlilik metnini bu davranışla hizala; reklam/analitik olmamasını ayrı, Google'a ve
kullanıcının seçtiği yedek hedefine aktarımları ayrı anlat. Bu değerlendirme
Play inceleme sonucunu kesinleştirmez; özellikle beklenmeyen hassas veri aktarımı
için normal kullanım içinde açıklama/onay gereklidir.
[Google Play User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en).

Gemini'nin ücretsiz/ücretli veri kullanımı koşulları bölgeye göre değişir.
Ücretsiz hizmet koşulları hassas/kişisel veri göndermemeyi ister ve inceleme/eğitim
kullanımını açıklar; AEA, İsviçre ve Birleşik Krallık için ücretli hizmet veri
koşulları istisnası vardır. Sadece Türkiye/Rusya/Azerbaycan dili veya telefon
diline bakarak kullanıcının hizmet koşulunu varsayma. Hedef pazar ve desteklenecek
Gemini kullanım biçimi insan tarafından kararlaştırılmalı; yalnız bir onay kutusu
eklemek hizmet koşulu sorununu çözmez.
[Gemini API koşulları](https://ai.google.dev/gemini-api/terms).

**Kabul testi:** İlk/tekrar tarama, galeri, kamera, iptal, AI karşılaştırması ve
onay reddi; dört dilde aynı anlam; onaydan önce sıfır fetch. Canlı metin/uygulama/
Play Data safety formu birlikte gözden geçirilmeli. Play Console incelenmedi:
"hiç veri toplanmıyor" seçeneğinin mevcut olduğu iddia edilmiyor. Cihaz dışına
işleme için gönderim, geliştiricinin sunucusu olmamasıyla kapsam dışına çıkmaz;
collected/shared ve kullanıcı başlatımlı paylaşım istisnalarını ayrı değerlendir.
[Data safety rehberi](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).

### SEC-05 — Bağımlılık güvenlik borcu

Canlı `npm audit --omit=dev --json`: **32 paket uyarısı — 1 kritik, 12 yüksek,
18 orta, 1 düşük**. Aynı kök advisory üst paketlere taşındığı için bunlar 32
bağımsız sömürü değildir. Ayrıntı: [audit özeti](security/2026-09-16/dependency-audit.json).

- `shell-quote@1.8.3`: npm kritik; `react-native → react-devtools-core` zinciri.
  React Native `Libraries/Core/setUpReactDevTools.js:16` development guard içerir.
  Telefonda release RCE kanıtı yok. Geliştirme/derleme ortamı yine değerlendirilmelidir.
  [İlgili advisory](https://github.com/advisories/GHSA-w7jw-789q-3m8p).
- `decode-uri-component@0.2.2 → query-string@7.1.3 → expo-router/@react-navigation/core`:
  çalışma zamanı yönlendirme zinciri nedeniyle ayrı incelenmeli. Expo'nun aktif
  `getStateFromPath.js:525` yolu kendi `expo.parseQueryParams` fonksiyonunu kullanıyor;
  eski query-string çağrısı yorum satırında. Bu nedenle kötü deep link'in uygulamayı
  kesin kilitlediği doğrulanmadı.
  [İlgili advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).
- `@xmldom/xmldom@0.8.11`, `metro@0.83.7 → image-size@1.2.1` gibi uyarılar config/
  derleme araçları zincirinde. `--omit=dev` bunları otomatik olarak mobil release
  çalıştırma yolundan ayırmaz. Snapshot diğer uyarıları da listeler.

**Düzeltme:** Önce lockfile ve `npm explain` ile her advisory'nin girişini,
uygulamada erişilebilirliğini ve yamalı sürümünü belirle. Expo SDK ile uyumlu
güncellemeler yap; gerekçesiz major downgrade/override uygulama. Audit bu oturumda
bazı Expo sorunlarına `expo@46.0.21` gibi uyumsuz major değişiklikler önerdi;
`npm audit fix --force` topluca uygulanmamalı.

**Kabul testi:** Yeniden audit + Expo sürüm uyumu + typecheck/Jest + release build.
Kalan her uyarı için paket, advisory, erişim koşulu ve kabul gerekçesi yazılmalı.
Bir `dev` etiketi tek başına risk kapatma kanıtı değildir.

### SEC-06 — Yedek boyutu kontrolü geç uygulanıyor

**Kanıt:** `src/services/backupService.ts:1180` picker'ı
`copyToCacheDirectory:true` ile açıyor; `:1188` dış sağlayıcının `asset.size`
değerini gerçek dosya boyutuna tercih ediyor; `:1192` tamamını belleğe okuyor.
Kurulu Android `DocumentPickerModule.kt:82` sınırsız kopyalıyor ve `:127` özgün
metadata boyutunu sonuçta koruyor; `DocumentDetailsReader.kt:19` sağlayıcının
`OpenableColumns.SIZE` değerini kullanıyor.

Kullanıcının büyük dosya seçmesi ilk kontrol öncesinde cache/diski tüketebilir;
yanıltıcı küçük metadata, büyük içeriğin JS belleğine alınmasına yol açabilir.
25 MB kontrolü mevcut, ancak bu önceki işlemleri sınırlamıyor. Gerçek cihaz OOM
veya etkileşimsiz uzak saldırı kanıtı yok.

**Düzeltme:** Platformun desteklediği, bayt sayarak sınırlı okuma/kopyalama akışını
kur. Gerçek cache stat'ını okumak JS tarafını iyileştirir; ilk sınırsız native
kopyayı tek başına çözmez. İptal/hata halinde yalnız sahip olunan geçici dosyayı temizle.

**Kabul testi:** Metadata 1 bayt, gerçek içerik 26 MB → tam `text()` okuması yok;
eksik/negatif metadata, UTF-8 bayt farkı, eşik aşımı ve yarım kopya temizliği.
Android'de belge sağlayıcısıyla doğrula; DB mutasyonu başlamamalı.

### SEC-07 — Geçici hassas dosyaların yaşam süresi belirsiz

**Kanıt:** `app/(tabs)/scanner.tsx:145`, `:324`, `:337` ve `:369` state/abort
temizliyor, picker'ın cache kopyasını silmiyor. `src/services/receiptParser.ts:149`
görseli kalıcı kayıt olarak saklamıyor. `src/utils/imageCompressor.ts:84` native
işlem timeout/abort'tan sonra tamamlanırsa `temporaryUri` atanmadığı için `:103`
temizliği bu dosyayı görmüyor. Sentetik geç tamamlama testinde silme çağrısı sıfır.
`backupService.ts:1104` export cache dosyası ve import kopyası da tutuluyor;
`dataReset.ts:118` veritabanını temizliyor.

**Etki:** İhtiyaç bitince fiş ve düz JSON yedekleri uygulama cache'inde kalabilir.
Başka uygulama erişimi kanıtlanmadı; Android sandbox'ı ve OS cache temizliği vardır.

**Düzeltme/test:** Uygulamaya ait dosya sahipliği ve saklama süresi tanımla; başarı,
iptal, unmount, geç native sonuç ve tekrar tarama senaryolarını kapsa. Kullanıcının
galeri orijinalini/dışarı kaydettiği yedeği silme. Paylaşılan dosyayı alıcı okumadan
silmek export'u bozabilir; temizliği paylaşım yaşam döngüsüne göre planla.

### SEC-08 — JSON derinlik sınırı yok

`src/utils/inputValidation.ts:113` özyinelemeli dolaşımı, backup parser'ı `:1202`
üzerinden çalıştırıyor. Yaklaşık 120 KB'lık, 20.000 kat iç içe bilinmeyen alan
`RangeError` üretiyor. `BackupSection.tsx:260` hatayı yakalıyor; kalıcı çökme veya
DB bozulması kanıtı yok.

**Düzeltme/test:** Derinlik ve toplam düğüm sınırı; mümkünse şemada gerekli alanları
seçen iteratif doğrulama. Sınır aşımı kontrollü `INVALID_FORMAT` vermeli; DB'ye
ulaşmamalı. Prototype anahtarlarını temizleme korumasını kaldırma.

### SEC-09 — Overlay izni daraltılmalı

Expo introspection `android.permission.SYSTEM_ALERT_WINDOW` üretiyor;
`app.json:16` yalnız `RECORD_AUDIO` blokluyor. Uygulamada overlay özelliği/özel erişim
istemi saptanmadı. İzin listesine girmek, Android'in kullanıcıdan özel erişim
istemeden overlay çizimine izin verdiği anlamına gelmez.

**Düzeltme/test:** Gerekli olmadığı doğrulanan izni `android.blockedPermissions`
içine al; release merged manifestte yokluğunu kontrol et. `node_modules` manifestini
elle düzenleme. [Expo izin yönetimi](https://docs.expo.dev/guides/permissions/).

### REL-01 — Production çıktısı mağaza biçiminde değil

`eas.json:18` production için `buildType:"apk"` kullanıyor. Yeni Google Play
uygulamalarının dağıtım biçimi AAB'dir.
[Play paket rehberi](https://support.google.com/googleplay/android-developer/answer/9844279?hl=en).

**Düzeltme/test:** Production `app-bundle`, preview gerekirse APK. Nihai AAB,
versionCode, paket kimliği ve Play App Signing doğrulanmalı. Paket adı daha önce
yayımlandıysa rastgele değiştirilmemeli. Bu bir güvenlik sömürüsü değildir.

## Doğrulanan korumalar

- Gemini sabit HTTPS endpoint ve `x-goog-api-key` header kullanıyor; üretim
  akışında anahtar/base64 log sızıntısı bulunmadı. SecureStore ve legacy taşıma var.
- Timeout, abort, sınırlı tekrar/model fallback; AI yanıtlarında şema, parasal değer,
  tarih, metin/kalem sayısı sınırları var. Öneri otomatik ürün birleştirmiyor.
- Backup doğrulaması yazmadan önce, restore transaction içinde; incelenen SQL
  değerleri parametreli. API anahtarı backup payload'ına girmiyor.
- Mevcut tracked dosyalardaki yaygın Google/GitHub/AWS/PEM anahtar kalıplarında
  eşleşme saptanmadı. Bu kapsamlı secret taraması garantisi değildir; Git geçmişi,
  harici EAS sırları ve imza deposu incelenmedi.
- RECORD_AUDIO kaldırma kuralı mevcut. READ/WRITE_EXTERNAL_STORAGE introspection'da
  Android 32 ile sınırlı; READ_MEDIA_* için doğrulanmış yayın bulgusu yok.
- Kontrol edilen notification receiver/service bileşenleri `exported=false`.

## Çalıştırılan kontroller ve yeniden üretim

Ortam: Node `v24.18.0`, npm `11.16.0`. Bunlar yerel kanıttır; CI sonucu değildir.

| Kontrol | Sonuç |
|---|---|
| `npm run typecheck` | Exit 0 |
| `npm test -- --ci --coverage=false --runInBand` | Exit 0; 127 suite, 1.036 test geçti |
| `npm audit --omit=dev --json` | Exit 1; advisory bulundu, ağ taraması tamamlandı |
| `npx expo config --type introspect` | Kaynak/native config incelendi; gerçek release manifest değil |
| Canlı gizlilik sayfası | HTTP 200; yerel HTML ile bayt eşitliği |
| Sentetik probe'lar | Aşağıdaki araçlarda mevcut kusurlar yeniden üretildi |

İlk npm/curl denemeleri sandbox DNS sınırına takıldı; izinli ağ denemeleri başarılı
oldu. Ham test günlükleri kişisel yerel yolları içerebildiği için depoya eklenmedi.

Repo kökünden, kurulu bağımlılıklarla:

```sh
node docs/evidence/security/2026-09-16/backup-probes.cjs
node docs/evidence/security/2026-09-16/remote-probes.cjs
```

İlk incelemede `backup-probes.cjs` mevcut kusurun varlığını doğruladı: remote logo kabulü ve derin
JSON `RangeError` bekler; bu sürümde exit 0. Düzeltme oturumunda beklentiler güvenli davranışa çevrildi; yeni sonuçlar düzeltme kaydındadır. `remote-probes.cjs` güvenli davranışı bekler; bu sürümde iki kontrol
başarısız, exit 1: silme hatası yayılmıyor ve geç görsel silinmiyor. Bunlar mevcut
Jest paketinin parçası değildir. Araçlar gerçek DB/native API/ağ yerine sentetik
bağımlılıklar kullanır; Android davranışının tamamını kanıtlamaz.

## Sonraki AI için çalışma sırası

1. Bu raporu ve AGENTS.md'yi oku; `git status --short`, güncel HEAD ve ilgili kod
   değişmiş mi kontrol et. Raporu eski commit için kanıt say.
2. SEC-01/02: küçük ayrı düzeltmeler ve gerçek davranışı kapsayan regresyonlar.
3. SEC-03/09/REL-01: Expo config/plugin değişiklikleri; gerçek native çıktı denetimi.
4. SEC-04: hedef pazar/Gemini hizmet biçimi kararını kullanıcıdan al; gerekli
   açıklama, dört dil ve gizlilik metnini birlikte hazırla. Site/Play yayımlamasını
   ayrıca yetkilendirmeden yapma.
5. SEC-05: her advisory'yi erişilebilirliğine göre ayır, uyumlu güncellemeleri yap.
6. SEC-06/07/08: sınırlı dosya işleme ve yaşam döngüsü; sentetik ve Android testleri.
7. Her düzeltmede ilgili Jest + typecheck; sonunda tam paket. AI katkı/izlenebilirlik
   kayıtlarına otomatik, cihaz ve insan kabulünü ayrı yaz.

Önerilen hedef testler: `backupService`, `inputValidation`, `imageCompressor`,
`ScannerScreen`, `ProductMatchingScreen`, `androidNotificationsSetup`, `dataReset`;
ayrıca gerçek `secureKeyStore` silme/migration testleri eklenmeli.

## Yayın öncesinde hâlâ gereken kanıt

- Üretilmiş release AAB/merged manifest: imza, debuggable kapalı, final cleartext
  politikası, exported bileşenler, tüm izinler ve backup XML'leri.
- O tarihte geçerli targetSdk/Play şartları, native kütüphane/16 KB uyumu ve
  Play Console pre-launch raporu. Kaynakta Expo sürümü görmek yeterli değil.
- Fiziksel Android: kilit ekranı finansal içerik, permission reddi, backup/restore,
  iptal/timeout/cache, soğuk açılış/deep link ve çevrimdışı manuel kullanım.
- Data safety beyanları ile yayımlanmış gizlilik metni/gerçek ağ davranışının eşleşmesi.

Bu kontroller yapılmadı. Testlerin geçmesi bu açık maddeleri kapatmaz.
