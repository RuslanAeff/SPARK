# 3 Ekim 2026 — Güvenlik doğrulaması ve düzeltmeler

İnsan isteği: Önceki güvenlik raporunu doğrula ve düzeltmeleri uygula.
Temel HEAD: `28d1e43`; önceki ölü kod temizliği ve `.DS_Store` değişiklikleri
korundu. Commit/push yapılmadı. Kanıtlar sentetik veriye dayanır.

## Uygulanan kod düzeltmeleri

1. **V6 yedek ilişkileri:** `backupService.ts/validateDepositRelations`;
   `containerVoucherRules.ts` canlı DAO ile ortak tarih/tutar/para birimi kuralları.
   Kupon tarihleri, kullanım durumu, recovery tutarı/para birimi/tarihi, harcamanın
   voucher payı ve çift kullanım denetlenir. Aynı UID ile çelişkili recovery
   içeriği veya açıkça farklı harcama bağlantısı reddedilir; transaction tüm
   yazıları geri alır. Tarih aralığı dışı redemption bağlantısının exportta null
   olması ve kupona bağlanmamış tarihsel cash kayıtları korunur. Şema, format
   sürümü, basılı fiş toplamı ve bütçe formülü değişmedi.
2. **Legacy anahtar temizliği:** `secureKeyStore.ts/writeSecureApiKey`, SQLite
   temizliği başarısızsa güvenli yazımı korur, `SECURE_KEY_CLEANUP_FAILED` döner
   ve migration'ı yeniden denemeye açar. İşlem kuyruğu korunur. `settings-ai.tsx`
   hata gösterir, başarı bildirmez ve yeniden deneme için girişi korur.
3. **Log mahremiyeti:** `ErrorBoundary.tsx` sabit hata kodu loglar;
   `geminiService.ts` ham exception, HTTP gövdesi ve bozuk fiş önizlemesini
   loglamaz. Geliştirme hata ekranının mevcut tanılama davranışı değişmedi.
4. **Gemini gövdesi:** `boundedFetch.ts/fetchBoundedText`, zaman aşımı ve iptali
   gövde tüketimine genişletir. Fetch abort'u dikkate almasa bile çağıran beklemez.
   JSON parse öncesi 2 MiB UTF-8 sınırı; Content-Length ön kontrolü; stream varsa
   gerçek byte sayımı ve reader temizliği uygulanır.

**Native sınır:** Global fetch stream sunmazsa `text()` öncesinde native katman
gövdeyi tamponlayabilir. JS parse sınırı native tepe bellek garantisi değildir.
Kesin native sınır için cihazda streaming transport/native okuyucu ayrıca
değerlendirilmelidir; bu madde tamamen kapanmış sayılmaz.

## Bağımlılık değişiklikleri ve açık kalanlar

`package.json` overrides ve lockfile birlikte güncellendi:

- `form-data` 4.0.5 → 4.0.6; altındaki `hasown` 2.0.2 → 2.0.4.
- Yalnız xcode ve @expo/ngrok altındaki `uuid` → 11.1.1. Tüketicilerin sadece
  `uuid.v4()` kullandığı kaynakta kontrol edildi; CommonJS çözümü, iki tüketiciden
  v4 üretimi ve xcode `generateUuid()` çalıştırılarak doğrulandı.
- Multipart CRLF sentetik smoke kontrolü geçti.
- Sorgulanan SDK 55 serisinde Expo 55.0.31 ve Router 55.0.18 güncel.
  SDK değişimi veya `npm audit fix --force` uygulanmadı.

Tam `npm audit --json`, 3 Ekim 2026:

| Durum | High | Moderate | Critical | Etkilenen paket kaydı |
|---|---:|---:|---:|---:|
| Önce | 50 | 11 | 0 | 61 |
| Sonra | 49 | 3 | 0 | 52 |

52 kayıt 52 bağımsız açık değildir; üst paketlere yayılan kayıtları içerir.
Kalan dört temel duyuru **kapatılmadı**:

| Paket | Duyuru | Durum / sonraki adım |
|---|---|---|
| braces 3.0.3 | GHSA-vfj7-8cjw-p6xm | Sorgulanan son sürüm etkileniyor. Güvenilmeyen glob/desenleri build/test araçlarına vermeme; upstream yamayı takip etme. |
| http-cache-semantics 4.2.0 | GHSA-ch52-4w7c-c8xp | Son sürüm etkileniyor; ngrok/got araç zinciri. Bu cache'i kullanıcılar arası kimlikli HTTP proxy'si olarak kullanma; upstream yamayı takip et. |
| node-forge 1.4.0 | GHSA-86w9-cpqp-85rv | Son sürüm etkileniyor; Expo CLI/code-signing zinciri. Sertifika girdilerinin güven sınırını koru; upstream Expo/forge yamalarını takip et. |
| decode-uri-component 0.2.2 | GHSA-vcc3-ghjq-m6fr | Yama 0.5.0 ESM-only, query-string 7.1.3 CommonJS require kullanıyor. Kör override yerine uyumlu üst paket güncellemesi gerekli. İncelenen Router tüketicileri stringify çağırıyor; parse saldırı yolu gösterilmedi. |

Azaltıcı önlemler saldırının imkânsız olduğunu veya kullanıcının riski kabul
ettiğini ifade etmez. Tünel/native code-signing entegrasyonu test edilmedi.

Resmi kaynaklar:
[form-data](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx),
[uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq),
[braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
[http-cache-semantics](https://github.com/advisories/GHSA-ch52-4w7c-c8xp),
[node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv),
[decode-uri-component](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).

## Test kanıtları

Yeni testler düzeltme öncesi üç kod bulgusunu yeniden gösterdi. Sonrasında:

- `backupService.test.ts`: tutarsız ilişkileri DB açılmadan reddetme, legacy cash.
- `containerDepositBackup.security.test.ts`: gerçek bellek içi SQLite üzerinde
  round-trip, tekrar import, tarih aralığı ve çakışmada rollback.
- `secureKeyStore.test.ts`, `SettingsAiScreen.test.tsx`: cleanup hatası,
  tekrar deneme, eşzamanlı save/read/delete ve başarı bildiriminin engellenmesi.
- `ErrorBoundary.security.test.tsx`, `geminiParse.test.ts`: üretim/geliştirme
  bayraklarında sentetik özel işaretin loga ulaşmaması.
- `boundedFetch.test.ts`: takılan gövde, dış iptal, büyük Content-Length,
  UTF-8 byte hesabı, yanlış küçük header ile büyük stream ve timer temizliği.

Teslim kontrolleri:

- `npm run typecheck -- --noUnusedLocals --noUnusedParameters --allowUnreachableCode false`: başarılı.
- `npm test -- --ci --coverage=false --silent`: **154 suite / 1202 test başarılı**.
- `npx --no-install expo install --check`: çevrimiçi kontrol başarılı.
- Android `expo export`: 2016 modüllü Hermes paketi başarılı; APK/native derleme değildir.
- `git diff --check`: başarılı.
- Fiziksel cihaz, release APK, gerçek API anahtarı ve kullanıcı verisi kullanılmadı.
  Cihaz ve kullanıcı kabulü açık.

## Sonraki AI için devam

Kod düzeltmelerini yeniden yazma; ilgili testleri başlangıç kanıtı olarak oku.
Önce dört kalan duyurunun yeni yamalarını sorgula. Paket sayısını sıfırlamak için
SDK downgrade veya uyumsuz ESM override uygulama. Cihazda restore/tekrar import,
anahtar kaydetme hatası/tekrar deneme, tarama iptali ve yavaş/büyük HTTP gövdesini
kontrol et. Yeni kanıt olmadan kalan bağımlılıkları/native bellek sınırını kapatma.
