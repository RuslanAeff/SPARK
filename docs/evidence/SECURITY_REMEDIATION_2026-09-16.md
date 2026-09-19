# Güvenlik düzeltme kaydı — 16 Eylül 2026

## Durum ve kanıt sınırı

**Yayın onayı verilmedi; hiçbir bulgu kapalı sayılmadı.** Kod düzeltmeleri ve
otomatik doğrulama aşağıda ayrı kaydedilmiştir. Gerçek cihaz, imzalı release
AAB/merged manifest ve insan ürün kabulü bu oturumda yoktur.

Başlangıç HEAD `25ef86c`. `AGENTS.md` ve güvenlik raporu okundu. Başlangıçta
QUALITY_AND_SECURITY, TRACEABILITY, AI_COLLABORATION_LOG değiştirilmiş; güvenlik
raporu ve security kanıt dizini izlenmeyen dosyalardı. Bu içerikler korunarak
bu oturumun kayıtları eklendi. İlk sentetik kontroller uzak logo kabulünü,
derin JSON RangeError'ını, yutulan silme hatasını ve geç görselin kalmasını
aynı HEAD üzerinde yeniden üretti. Config/UI/picker/dependency bulguları da
güncel kod ve kurulu SDK ile karşılaştırıldı.

İş sırası raporun “Sonraki AI için çalışma sırası” bölümüdür:
SEC-01/02 → SEC-03/09/REL-01 → SEC-04 → SEC-05 → SEC-06/07/08.
Çapraz katman kabul ölçütleri: dış URI render/DB sınırını geçmez; başarısız
silme başarı göstermez; onay öncesi AI gönderimi yoktur; dosya sınırı okuma
anında uygulanır; native kanıt otomatik JS testinden ayrı kalır.

## Bulgu başına değişiklik ve doğrulama

| Bulgu | Uygulanan değişiklik | Çalıştırılan regresyon / kanıt | Açık kalan |
|---|---|---|---|
| SEC-01 | v1–v4 normalizasyonunda logo/fiş URI null; mevcut satıcı logosu korunur; üç satıcı Image noktası yalnız yerel şema kabul eder | backupService: dört sürüm × dört şema için normalizasyon ve gerçek restore yazma yolu, yerel logo korunması; localImageUri; parser probe | Android sentetik import ve kontrollü ağ kaydı; eski yerel cache logolarının cihazda gösterimi |
| SEC-02 | migration/okuma/yazma/silme kuyruğu; legacy silme + SecureStore silme hatası yayılır; UI anahtar var durumunu koruyup hata verir | secureKeyStore: native/SQLite hata, başarı, queue recovery, bekleyen migration ile yarış, modül yeniden yüklemede anahtar dönmeme; SettingsAiScreen hata UI; remote probe | Gerçek SecureStore hatası, cold-start ve legacy SQLite cihaz testi |
| SEC-03 | Uygulamaya ait Expo plugin/XML; SecureStore ve notifications sharedpref legacy/cloud/device-transfer dışında; önceki include domain korunur | privateBackup + androidNotificationsSetup; izole Android prebuild manifest referansları ve kopyalanmış iki XML karşılaştırması | Release merged manifest/XML; cihaz backup/restore/reboot ve normal hatırlatma kurma |
| SEC-09 | SYSTEM_ALERT_WINDOW blockedPermissions içine alındı | privateBackup; prebuild manifestte tools:node=remove | Final merged release manifestte yokluğu |
| REL-01 | production app-bundle; preview APK korundu, paket adı/versionCode değiştirilmedi | privateBackup config regresyonu; prebuild başarılı | İmzalı nihai AAB, versionCode/Play App Signing ve Play Console kabulü |
| SEC-04 | Her tarama/ürün önerisi için alıcı/veri/amaç açıklaması ve Gönder eylemi; cancel/dismiss/abort reddeder. Ürün kararı alındıktan sonra (ADR-012: ücretsiz katman serbest, pazar global) belirsiz "hizmet koşullarına bağlıdır" ifadesi dört dilde kaldırıldı; yerine ücretsiz katmanda içeriğin insan incelemesi dahil hizmet geliştirmede kullanılabildiği ve verinin yurt dışı sunuculara gittiği yazıldı. Anahtar yardımı ve TR/EN gizlilik metni aynı bilgiyle güncellendi | confirmAiTransfer; ScannerScreen kamera/galeri red ve dört dil başarı; ProductMatchingScreen red/başarı; localeParity; metin değişikliğinden sonra typecheck ve tam Jest yeniden geçti | Native onay/geri tuşu ve sıfır ağ kaydı; çeviri kullanıcı kabulü; canlı gizlilik sitesi ve Play Data safety beyanı; hukuki uygunluk incelemesi (global kapsam GDPR dahil) |
| SEC-05 | SDK 55 uyumlu yamalar; RN 0.83.10, Expo 55.0.31; force/downgrade/override yok | npm audit --omit=dev: 32 → 15 orta; kritik/yüksek/düşük yok; çevrimiçi expo install --check geçti; typecheck ve tam Jest | İki kök advisory'nin 15 paket kaydı açık; release build ve deep-link cihaz testi; açık insan risk kabulü yok |
| SEC-06 | Picker copyToCacheDirectory=false; yeni yerel Android InputStream/Apple FileHandle modülünde 25 MB bayt limiti, UTF-8 doğrulama ve kaynak kapatma; cache kopyası yok | boundedBackupReader; backupService yanlış küçük/eksik/negatif metadata ve DB'ye ulaşmama; gerçek Foundation yardımcı kodunda 5 kontrol: UTF-8, bozuk UTF-8, çok bayt farkı, 25/26 MB | Android native sınıfı/JNI köprüsü ve iOS Expo köprüsü derlenmedi; gerçek content/document provider, security-scoped URL, düşük bellek cihaz kontrolü |
| SEC-07 | Tarama sahipliğine göre kopya temizliği, geç native/picker sonucu; sahipli kopya deseni picker'ın ürettiği uzantıları kapsar (jpg/jpeg/png/webp/heic/heif/gif/avif/bmp/tif/tiff); paylaşım başlamayan export sonunda temizlenir, başlatılan paylaşım 24 saat sonrası ilk açılış/export temizliğine bırakılır; reset aktif olmayan yedekleri temizler | imageCompressor; ScannerScreen; temporaryFiles galeri/path traversal/aktif paylaşım/TTL ve dört uzantıda silme; backupExportCleanup başarı/iptal/hata saklama; dataReset; remote probe | Gerçek alıcının geç okuması, dosya silme hatası, kamera unmount/timeout/tekrar tarama; eski sahipsiz picker cache'i logolarla ayırt edilmeden temizlenmedi; cihazda üretilen gerçek picker uzantıları doğrulanmadı; saklama varsayımı insan kabulü bekler |
| SEC-08 | Iteratif sanitizer: 64 derinlik, 250.000 düğüm; prototype anahtar temizliği korunur; kontrollü INVALID_FORMAT | inputValidation derin nesne/dizi, düğüm ve prototype; backupService; parser probe 20.000 derinlik, sıfır DB çağrısı | Gerçek büyük yedek/düşük bellek cihaz testi ve kullanıcı kabulü |

## Otomatik sonuçlar

- Uzantı kapsamı genişletildikten ve SEC-04 metinleri ürün kararına göre yeniden
  yazıldıktan sonra `npm run typecheck` ve tam Jest paketi
  yeniden çalıştırıldı: exit 0 ve 135 suite / 1.083 test geçti. İki sentetik probe
  da bu son durumda güvenli davranışı doğruladı.
- `npm run typecheck`: exit 0. Sonradan eklenen test fixture'ında eksik
  `lastModified` ilk çalıştırmada yakalandı, düzeltildi ve typecheck tekrar geçti.
- `npm test -- --ci --coverage=false --runInBand`: **135 suite, 1.083 test geçti**.
  Her aşamada ilgili alt paketler de çalıştırıldı; son toplam hepsini içerir.
- `npx expo install --check`: çevrimiçi **Dependencies are up to date**, exit 0.
  İlk fix dinamik config'e expo-asset plugin'ini yazamadı; plugin app.json'a
  eklendi, kalan jest-expo yaması tamamlandı ve kontrol tekrar geçti.
- İki rapor probe'u artık güvenli beklentilerle geçer. backup-probes native
  okuyucuyu sentetik raw içerikle değiştirir; native dosya okuma kanıtı değildir.
- Foundation okuyucunun gerçek yardımcı kodu Swift ile derlendi ve 5 kontrol geçti.
  Bu macOS/Foundation kanıtıdır; iOS belge sağlayıcısı veya Android testi değildir.
- Android prebuild izole geçici projede `--platform android --no-install` ile geçti.
  İki manifest XML referansı doğru; üretilen XML'ler kaynaklarla eşit; overlay
  girdisi kaldırma talimatı taşır. Android autolinking yerel modülü buldu.
- `git diff --check`: geçti. Ham loglar kişisel ortam yolları nedeniyle depoya konmadı.

Android release derlemesi yapılamadı: `java -version` Java runtime bulunamadığını
bildirdi; `adb` de kullanılabilir değildi. JDK/SDK kurma, gerçek cihaz kullanma,
EAS'e proje gönderme veya mağaza yayını yapılmadı. Swift kontrolü bu eksiği kapatmaz.

## Ürün kararları ve kalan bağımlılıklar

Karar alındı (16 Eylül 2026, kullanıcı): **ücretsiz Gemini katmanı serbest,
pazar global**. Gerekçe ve değişmezler [ADR-012](../decisions/ADR-012-ai-transfer-service-and-market-scope.md).
Karar öncesi metinler kararı kullanıcıya devreden "hesap, bölge ve hizmet
koşullarına bağlıdır" ifadesini taşıyordu; bu ifade kaldırıldı ve ücretsiz
katmanın bedeli (insan incelemesi dahil hizmet geliştirme kullanımı) ile yurt
dışı aktarım dört dilde ve gizlilik metninde açıkça yazıldı. Uygulama anahtar
katmanını tespit etmez; ücretli anahtar yalnızca önerilir.

Bu karar riski şeffaf biçimde kullanıcıya devreder, hukuki uygunluğu kanıtlamaz.
Global kapsam GDPR dahil en geniş uyum yükünü getirir ve ücretsiz katmanda
kişisel finansal verinin insan incelemesine açık olması bu yükün en hassas
noktasıdır. Hukuki inceleme, canlı gizlilik sitesinin yayını ve Play Data safety
formunun bu metne göre doldurulması yapılmadı; SEC-04 kapalı sayılmadı.

Kalan 15 paket, erişim koşulları ve kabul verilmemesinin gerekçesi
[bağımlılık kaydında](security/2026-09-16/DEPENDENCY_REMEDIATION.md);
[advisory/sürüm matrisi](security/2026-09-16/dependency-remediation.json) ve
[son audit](security/2026-09-16/dependency-audit-after.json) ayrı kanıttır.

## Yeniden üretim ve cihaz kabulü

```sh
npm run typecheck
npm test -- --ci --coverage=false --runInBand
node docs/evidence/security/2026-09-16/backup-probes.cjs
node docs/evidence/security/2026-09-16/remote-probes.cjs
swiftc -module-cache-path /tmp/spark-swift-module-cache modules/spark-bounded-file/ios/BoundedUtf8File.swift docs/evidence/security/2026-09-16/bounded-file-probe.swift -o /tmp/spark-bounded-file-probe
/tmp/spark-bounded-file-probe
```

Native modül için yeniden development/release build şarttır. Expo Go/modülsüz
build import için INVALID_FORMAT verir; sınırsız okuma fallback'i yoktur.
Cihaz testinde gerçek kişisel veri yerine sentetik dosya, anahtar ve bildirim
kullanılmalıdır. 1 bayt bildiren 26 MB sağlayıcı, eksik/negatif metadata, UTF-8,
iptal/hata ve kaynak kapanması; kamera/galeri iptal/timeout/geç sonuç; alıcı okuması
ve TTL; tüm yedek taşıma yolları; kilit ekranı/soğuk açılış/deep-link ve dört dilde
onaydan önce sıfır ağ isteği ayrı ayrı kaydedilmelidir.

Canlı gizlilik sitesi, Play Console/Data safety formu, kullanıcı hesapları,
API anahtarları veya gerçek finansal kayıtlar bu düzeltme oturumunda değiştirilmedi.
Commit, push veya yayın yapılmadı. Önceki raporun tarihsel bulguları bu kayıtla
birlikte okunmalıdır; eski satır numaraları güncel koda birebir referans değildir.
