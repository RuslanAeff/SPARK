# ADR-002: SQLite eşzamanlılık ve transaction sınırları

- **Status:** Accepted
- **Kayıt türü:** Retrospective
- **Kayda geçirildi:** 1 Ağustos 2026
- **Özgün karar tarihi:** Bilinmiyor; `docs/history/DESIGN_BRIEF_LEGACY_2026-08-01.md` P6/P26/P27/P28/P29 ve bildirim kayıtları 2026 içindeki aşamalı düzeltmeleri gösteriyor.
- **Özgün commit:** Bilinmiyor

## Bağlam

SPARK offline-first çalışır ve ana veriyi tek `spark.db` SQLite veritabanında tutar. Expo SQLite bağlantısında seed transaction'ı ile paralel bir SELECT'in aynı anda `prepareAsync` başlatması temiz kurulumda `Cannot use shared object that was already released` hatasına yol açtı. Ayrı read-modify-write bildirim işlemleri de aynı JSON snapshot'ını birbirinin üstüne yazabiliyordu. Header/items veya ödeme/kalan gibi ilişkili çoklu yazıların transaction dışında kalması kısmi finansal durum riski taşıyordu.

## Karar

1. `getDatabase()` process-wide tek `initPromise` kullanır. Open, PRAGMA, şema/migration ve idempotent seed tamamlanmadan bağlantı tüketiciye hazır sayılmaz.
2. Aynı bağlantıda prepared sorgular ölçüm ve cihaz kanıtı olmadan `Promise.all` ile paralelleştirilmez. Özellikle bütçe toplamları güvenli biçimde seri okunur.
3. Tek iş olayına ait birden fazla yazı aynı transaction içinde atomik yürütülür. Örnekler: fiş header+items, borç ödeme INSERT+remaining UPDATE, vendor ilişkili silme ve backup import.
4. Uzun/bağımsız okumalar mümkünse transaction öncesi çözülür; transaction yalnız tutarlı yazı penceresini kapsar.
5. Notification feed gibi read-modify-write akışları ortak process mutation queue üzerinden sıralanır. Feed ve onu üreten/susturan rule state aynı commit'te yazılır; native'de uygun olduğunda `withExclusiveTransactionAsync`, web'de kontrollü fallback kullanılır.
6. Mutasyon loader'ları bozuk JSON/DB okumasını boş veri sayıp geri yazmaz; strict read başarısızsa mutasyon da başarısız olur.
7. WAL ve foreign keys açılışta etkinleştirilir; `PRAGMA quick_check` tanılama amaçlıdır ve kullanıcı onayı olmadan otomatik veri kurtarma/silme yapmaz.

## Değişmezler

- Init/seed promise dışına taşınmaz.
- Bir aggregate yeni DAO sorgusu gerektiriyorsa mevcut seri zincir varsayılan olarak korunur.
- Atomik domain değişikliğinde tüm ilgili tablolar aynı transaction'da güncellenir veya hiçbiri güncellenmez.
- Transaction tamamlandıktan sonra isteğe bağlı yan etkiler (ör. in-app notification) kritik finansal commit'i geri alamaz.
- Queue görevi hata verdiğinde kuyruk zehirlenmez; sonraki görev çalışabilmelidir.
- Silme/düzeltme sonrasında türetilmiş değerler kanonik DB satırlarından yeniden okunur; kalıcı “delta cache” tutulmaz.

## Sonuçlar ve ödünleşimler

**Olumlu:** temiz kurulum yarışı, lost update, kısmi ödeme/fiş ve feed/rule ayrışması engellenir. Mutation sınırları test edilebilir hâle gelir.

**Bedel:** bazı küçük indeksli aggregate sorguları paralel olabilecekken seri çalışır. Process içi queue başka bir process'i koordine etmez. Web fallback ve native exclusive transaction davranışı ayrı test yüzeyleridir.

## Doğrulama

- DB init'in yalnız bir promise üzerinden çalıştığını ve seed sırasında başka tüketiciye bağlantı açılmadığını doğrula.
- Transaction testlerinde orta yazıda hata enjekte edip tüm ilgili durumun rollback olduğunu kontrol et.
- Notification testlerinde feed+rules atomikliği, tek feed yazısı, strict read ve hata sonrası queue devamını koru.
- SQLite yaşam döngüsü değişikliklerinde temiz kurulum fiziksel cihaz testi ekle.

## Kanıt

- `src/db/database.ts`
- `src/db/debtDao.ts`
- `src/services/receiptParser.ts`
- `src/services/backupService.ts`
- `src/hooks/useBudget.ts`
- `src/notifications/storage.ts`
- `src/context/NotificationsContext.tsx`
- `src/notifications/__tests__/storage.test.ts`
- `docs/history/DESIGN_BRIEF_LEGACY_2026-08-01.md` P6, P26, P27, P28, P29

## Yeniden değerlendirme koşulları

Expo SQLite sürümü connection pool/transaction izolasyonu için yeni, cihaz testleriyle doğrulanmış bir sözleşme sağlarsa seçili salt-okunur sorgular paralelleştirilebilir. Değişiklik önce stres testi ve yeni ADR gerektirir.
