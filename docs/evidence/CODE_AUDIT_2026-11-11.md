# S.P.A.R.K. kod denetimi — 11 Kasım 2026

Güvenlik, hata ve performans bulguları. Bu belge bir düzeltme ajanına (insan veya yapay zekâ) iş listesi olarak verilmek üzere yazıldı: her bulgu kendi başına okunabilir, konumu, kanıtı, önerilen düzeltmesi ve kabul kriteri vardır.

## 1. Kapsam ve yöntem

- **Sürüm:** `package.json` 3.4.0, dal `main`, commit `538c51e`.
- **Yöntem:** Statik kod okuması. Cihazda çalıştırma, dinamik test veya bağımlılık taraması yapılmadı.
- **Başlangıç durumu:** `npm run typecheck` temiz; `npm test -- --ci --coverage=false` 155 suite / 1203 test geçti. Aşağıdaki bulguların hiçbiri mevcut testlerle yakalanmıyor.
- **Bu denetimde hiçbir ürün kodu değiştirilmedi.**

### Okunan dosyalar (tam veya büyük bölümü)

`src/db/` (tüm DAO'lar, `database.ts`, `schema.ts` DDL kısmı), `src/services/` içinden `geminiService.ts`, `boundedFetch.ts`, `secureKeyStore.ts`, `boundedBackupReader.ts`, `temporaryFiles.ts`, `receiptParser.ts`, `dataReset.ts`, `subscriptionDetector.ts`, `backupMeta.ts`; `src/utils/inputValidation.ts`, `dateUtils.ts` (ilk 120 satır), `imageCompressor.ts`, `localImageUri.ts`; `src/hooks/useBudget.ts`, `useExpenses.ts` (kısmen), `useSavingsGoalData.ts`, `useDatabase.ts`; `src/context/CurrencyContext.tsx`, `RefreshContext.tsx`, `NotificationsContext.tsx` (kısmen); `app.json`, `app.config.js`, `eas.json`, `.github/workflows/ci.yml`, `plugins/`.

### Yalnız kısmen bakılan veya hiç bakılmayan alanlar

Bu alanlarda bulgu olmaması "temiz" anlamına gelmez:

- `src/services/backupService.ts` — 2622 satırın yaklaşık 450'si okundu (doğrulama girişi, export, import başlangıcı). İçe aktarımın yinelenen kayıt eşleme mantığı (satır 1560–2610) incelenmedi.
- `src/services/androidNotificationsSetup.ts`, `src/notifications/` (yalnız `storage.ts` transaction bölümleri okundu).
- `app/` ekranları — yalnız kaydetme/silme işleyicileri ve yenileme orkestrasyonu okundu; render ağacı, animasyon ve gesture kodu incelenmedi.
- `src/components/` (tümü), `src/db/productIdentityDao.ts`, `recurringPaymentReminderDao.ts`, `budgetRolloverDao.ts`, `app/product-matching.tsx`, `app/notifications.tsx`.
- Native modül (`modules/spark-bounded-file` Kotlin/Swift), i18n dosyaları.
- Bağımlılık zafiyet taraması (`npm audit`) çalıştırılmadı.

### İkinci geçiş: doğrulama ve ek tarama (aynı gün, ayrı oturum)

İlk geçişin 33 bulgusu koda karşı tek tek doğrulandı ve ilk geçişin bakmadığı alanlar tarandı. Sonuçlar §3.1 tablosunda; yeni bulgular BUG-19…BUG-31, SEC-08…SEC-09 ve PERF-09…PERF-10 olarak eklendi. İlk geçişin hatalı veya eksik kalan ifadeleri yerinde düzeltildi ve **"Doğrulama notu"** satırıyla işaretlendi.

- **Çalıştırılanlar:** `npm run typecheck` temiz; `npm test -- --ci --coverage=false` 155 suite / 1203 test geçti (ilk geçişin beyanı doğru). `npm audit --omit=dev` çalıştırıldı (SEC-08).
- **Bu geçişte tam okunanlar:** `backupService.ts` (2622 satırın tamamı), `androidNotificationsSetup.ts`, `notifications/storage.ts`, `buildNotifications.ts`, `NotificationsContext.tsx`, native modül (Kotlin + Swift), `plugins/`, tüm DAO'lar (`productIdentityDao`, `recurringPaymentReminderDao`, `budgetRolloverDao` dahil), `app/_layout.tsx`, `add-expense.tsx`, `edit-items.tsx`, `categories.tsx`, `deposit-wallet.tsx`, `goal-settings.tsx` (mantık kısmı), `settings-budget.tsx` (mantık kısmı), `scanner.tsx` (stiller hariç), `transactions.tsx`, `index.tsx` (ilk 400 satır), `DebtSheet`/`IncomeSheet`/`BackupSection`/`DataResetSection` işleyicileri.
- **Kütüphane kaynağından doğrulananlar:** `node_modules/expo-sqlite` 55.0.20 içindeki `withTransactionAsync` / `withExclusiveTransactionAsync` uygulaması (BUG-05).
- **Hâlâ okunmayanlar:** `app/notifications.tsx`, `app/subscriptions.tsx`, `app/product-matching.tsx` (yalnız sorgu deseni), `app/settings-general.tsx`, `app/settings-ai.tsx`, `reminderScheduler.ts`, `reminderNativeSchedule.ts`, `attentionNativeSchedule.ts`, `reminderNotification*.ts`, grafik ve animasyon bileşenleri, tema katmanı, i18n dosyaları. Cihazda hiçbir şey çalıştırılmadı.

## 2. Düzeltme ajanı için kurallar

1. Önce `AGENTS.md` dosyasını oku; oradaki değişmezler bu belgeden önce gelir.
2. Her bulguyu ayrı, küçük bir değişiklik olarak ele al. Bulguları tek commit'te birleştirme.
3. Düzeltmeden önce bulgunun hâlâ geçerli olduğunu belirtilen satırda doğrula; satır numaraları `538c51e` commit'ine göredir.
4. Her düzeltme için önce hatayı yakalayan bir Jest testi yaz, sonra düzelt.
5. Her değişiklikten sonra `npm run typecheck` ve ilgili testleri çalıştır.
6. **"Karar gerekli"** işaretli bulgularda ürün sahibine sor; kendi başına seçim yapma.
7. Şema değişikliği gerekiyorsa geriye dönük migration ekle ve backup export/import biçimini birlikte değerlendir.
8. Kullanıcıya görünen yeni metinler TR, EN, AZ, RU akışına eklenir; `az.json` ve `ru.json` doğrudan düzenlenmez.

**Güven düzeyi etiketleri:** *Doğrulandı* = kod yolu baştan sona okundu. *Doğrulanmalı* = kod okumasından çıkarım; cihazda veya testle teyit gerekir.

## 3. Özet

| Kimlik | Önem | Başlık |
|---|---|---|
| BUG-01 | Yüksek | Farklı para birimleri bütçe ve analiz toplamlarında tek para birimi gibi toplanıyor |
| BUG-02 | Yüksek | Satıcı silme, kullanılmış depozito kuponlarını kalıcı olarak "kullanıldı" durumunda bırakıyor |
| BUG-03 | Orta | Kalem düzenleme (yalnız ad değişikliği dahil) fişin basılı toplamını siliyor (ADR-004 kararı gerekli) |
| BUG-04 | Yüksek | Alışveriş fişindeki kupon son kullanma tarihi doğrulanmıyor; fiş kaydı başarısız olabiliyor ve sonraki yedekler bozuluyor |
| BUG-05 | Orta | `withTransactionAsync` dışlayıcı değil; eşzamanlı yazılar başka transaction'a karışabilir |
| BUG-06 | Orta | Toplu silme 500 kayıtta sessizce kesiliyor, bildirim yanlış sayı gösteriyor |
| BUG-07 | Orta | Veritabanı açılış hatası kalıcı; yeniden deneme yolu yok |
| BUG-08 | Orta | UTC tabanlı "bugün" hesapları gece yarısı civarında yanlış gün üretiyor |
| BUG-09 | Orta | Hedef ve kategori limiti yazıları atomik değil, doğrulamadan geçmiyor |
| BUG-10 | Orta | `ExpenseDao.create/update` tarih, para birimi ve not alanlarını doğrulamıyor |
| BUG-11 | Orta | İşlem araması yalnız yüklenmiş sayfalarda çalışıyor |
| BUG-12 | Orta | ADR-002 ihlalleri: aynı bağlantıda `Promise.all` ile paralel sorgu |
| BUG-13 | Orta | Kullanımdaki kategori silinemiyor ve kullanıcıya neden söylenmiyor |
| BUG-14 | Düşük | ASCII dışı harflerde satıcı ve kategori kopyaları oluşuyor |
| BUG-15 | Düşük | `add-expense` silme işleyicisinde hata yakalama yok; kaydetme koruması state tabanlı |
| BUG-16 | Düşük | "İhtiyaç/İstek" ayrımı Türkçe kategori adlarına sabitlenmiş |
| BUG-17 | Düşük | Gemini katmanında küçük tutarsızlıklar |
| BUG-18 | Düşük | Tohumlama ve eski `ALTER TABLE` adımlarında migration hijyeni |
| BUG-19 | Yüksek | Dışa aktarım kendi çıktısını doğrulamıyor; tek bozuk kayıt tüm yedekleri geri yüklenemez yapıyor |
| BUG-20 | Orta | İçe aktarım, yerelde değişmiş kayıtları "geçersiz dosya" diye reddediyor |
| BUG-21 | Orta | Harcama ve borçlarda kalıcı kimlik yok; düzenlenen kayıt içe aktarımda ikinci kez ekleniyor |
| BUG-22 | Orta | Kategori limitleri üç farklı dönem tanımıyla okunuyor; yeni ayda limitler kayboluyor |
| BUG-23 | Orta | Varsayılan 5000 PLN bütçe, silindikten veya sıfırlamadan sonra açılışta geri geliyor |
| BUG-24 | Orta | Tutar alanlarında tutarsız ayrıştırma; hatalı girdi sessizce kırpılıyor |
| BUG-25 | Düşük | İşlem listesi her odaklanmada ilk 60 kayda sıfırlanıyor |
| BUG-26 | Düşük | Tarayıcıda depozito kuponu "Düzenle" etiketli düğmeyle kaydediliyor |
| BUG-27 | Düşük | Satıcı logosu önbellekteki geçici dosyaya işaret ediyor |
| BUG-28 | Düşük | Depozito kuponu silinemiyor; başka para birimindeki kuponlar görünmüyor |
| BUG-29 | Düşük | `edit-items` ek sorunları: depozito başlığı, yuvarlama, çift dokunuş |
| BUG-30 | Düşük | Küçük arayüz ve dayanıklılık düzeltmeleri |
| BUG-31 | Orta | Yedek kapsamı: hedef, limitler ve döngü günü taşınmıyor; "tam yedek" seçeneği yok |
| SEC-01 | Orta | Yedek dosyası şifresiz ve yerel dosya yollarını içeriyor |
| SEC-02 | Düşük | Üretimde korumasız `console.error(e)` çağrıları ve ham hata mesajı |
| SEC-03 | Düşük | Veri sıfırlama silinen satırları diskten kazımıyor |
| SEC-04 | Düşük | `app.config.js` yorumu ile `app.json` çelişiyor (EAS projectId) |
| SEC-05 | Düşük | `sanitizeText` yön değiştirme ve sıfır genişlikli karakterleri temizlemiyor |
| SEC-06 | Düşük | `READ_EXTERNAL_STORAGE` izni gerekli olmayabilir |
| SEC-07 | Düşük | CI'da bağımlılık ve secret taraması yok |
| SEC-08 | Düşük | Derin bağlantı ayrıştırıcısında bilinen DoS zafiyeti üretim paketine giriyor |
| SEC-09 | Düşük | Kategori `icon` ve `color` alanları biçim doğrulamasından geçmiyor |
| PERF-01 | Yüksek | Ürün analizi tüm `expense_items` tablosunu JS'e çekiyor |
| PERF-02 | Yüksek | Yedek dışa aktarımı harcama başına ayrı sorgu çalıştırıyor |
| PERF-03 | Orta | Dashboard kategori limitleri: limit başına iki sorgu |
| PERF-04 | Orta | Fiş kaydında kalem başına 1–3 kategori sorgusu |
| PERF-05 | Orta | Analiz ekranı her odaklanmada 17 yükleyiciyi baştan çalıştırıyor |
| PERF-06 | Orta | Her soğuk açılışta `quick_check` ve koşulsuz şema denemeleri |
| PERF-07 | Düşük | Her bildirim senkronunda abonelik tespiti baştan yazılıyor |
| PERF-08 | Düşük | Fiş yanıtı iki kez ayrıştırılıyor |
| PERF-09 | Orta | İçe aktarım satır başına ayrı sorgu çalıştırıyor; büyük yedekte uzun transaction |
| PERF-10 | Düşük | Bütçe geçmişi kartı dönem başına 6–7 sorgu çalıştırıyor |

### 3.1 İlk geçiş bulgularının doğrulama sonucu

Her satır, ikinci geçişte ilgili kod yolunun yeniden okunmasına dayanır. **Doğrulandı** = bulgu ve konum doğru. **Düzeltildi** = bulgu geçerli ama metni yanlış veya eksikti; ilgili bölüm güncellendi.

| Kimlik | Sonuç | Not |
|---|---|---|
| BUG-01 | Doğrulandı | Kapsam genişletildi: para birimi yarı etiket, yarı anahtar (bkz. bölümdeki not). |
| BUG-02 | Doğrulandı | `container_deposit_recoveries` CASCADE ile siliniyor; yalnız kupon satırı öksüz kalıyor. |
| BUG-03 | Düzeltildi | 1. senaryo geçerli. 2. ve 3. senaryo ADR-004 madde 5 ve 10'a göre kasıtlı davranış; önem Orta'ya çekildi. |
| BUG-04 | Düzeltildi | Etki ilk yazılandan büyük: bozuk kupon kalıcı, silinemiyor ve sonraki tüm yedekleri bozuyor (BUG-19, BUG-28). |
| BUG-05 | Düzeltildi | Kütüphane kaynağından doğrulandı; mekanizma ilk yazılandan ağır (bölümdeki not). Yeniden üretim hâlâ gerekli. |
| BUG-06 | Doğrulandı | 500'den fazla seçim yalnız sürükleyerek çoklu seçimle mümkün. |
| BUG-07 | Doğrulandı | — |
| BUG-08 | Düzeltildi | `subscriptionDetector` maddelerinin pratik etkisi yok; liste daraltıldı. |
| BUG-09 | Doğrulandı | Limit alanının ondalık girişi ayrı bulgu oldu (BUG-24). |
| BUG-10 | Doğrulandı | Ek etki: 1000 karakteri aşan not yedeği bozuyor (BUG-19). |
| BUG-11 | Doğrulandı | — |
| BUG-12 | Düzeltildi | `refreshAll` aynı eşzamanlılığı her odaklanmada üretiyor; listeye eklendi. |
| BUG-13 | Doğrulandı | — |
| BUG-14 | Doğrulandı | Ek etki: kopya satıcılar içe aktarımda harcamaları çoğaltıyor (BUG-21). |
| BUG-15 | Doğrulandı | Aynı desen `IncomeSheet` ve `edit-items` içinde de var (BUG-29, BUG-30). |
| BUG-16 | Doğrulandı | Sistem kategorileri Türkçe anahtarla saklandığı için varsayılan ağaçta çalışıyor; yalnız kullanıcı kategorileri etkileniyor. |
| BUG-17 | Doğrulandı | `:1045` pratikte ulaşılamaz (aynı metin önceden doğrulanıyor). |
| BUG-18 | Düzeltildi | Tohumlama yaklaşık 100 değil 60 ekleme (10 kök + 50 alt kategori). |
| SEC-01 | Doğrulandı | — |
| SEC-02 | Düzeltildi | Liste eksikti; 13 çağrı daha eklendi. |
| SEC-03 | Doğrulandı | Güven düzeyi "Doğrulanmalı" olarak kalıyor. |
| SEC-04 | Doğrulandı | — |
| SEC-05 | Doğrulandı | — |
| SEC-06 | Düzeltildi | İzin kaldırılırsa `scanner.tsx:273` içindeki açık izin isteği de kaldırılmalı. |
| SEC-07 | Düzeltildi | `npm audit` sonucu ve iki ek madde eklendi. |
| PERF-01 | Doğrulandı | — |
| PERF-02 | Doğrulandı | — |
| PERF-03 | Düzeltildi | "Doğrulanmalı" notu doğrulandı ve ayrı hata oldu (BUG-22). |
| PERF-04 | Doğrulandı | — |
| PERF-05 | Doğrulandı | 17 yükleyici sayısı doğru. |
| PERF-06 | Doğrulandı | — |
| PERF-07 | Doğrulandı | — |
| PERF-08 | Doğrulandı | Maliyeti ihmal edilebilir; en düşük öncelik. |

## 4. Hata bulguları

### BUG-01 — Farklı para birimleri tek para birimi gibi toplanıyor

- **Önem:** Yüksek · **Güven:** Doğrulandı · **Karar gerekli**
- **Konum:** `src/hooks/useBudget.ts:125-132`; `src/db/expenseDao.ts:412-442, 462-579`; `src/db/debtDao.ts:225-264`; `src/db/incomeDao.ts:69-77`; `src/services/receiptParser.ts:115`
- **Sorun:** Fiş, yapay zekânın okuduğu para birimiyle kaydediliyor (`currency: receipt.currency || 'PLN'`). Bütçe ve analiz sorgularının hiçbirinde `currency` filtresi yok; tutarlar sayısal olarak toplanıyor. Aynı hook içinde depozito ve devir sorguları ise `budgetCurrency` ile filtreleniyor, yani davranış kendi içinde de tutarsız.
- **Etki:** PLN bütçesi olan kullanıcı 50 EUR'luk bir fiş taradığında bütçeden 50 PLN düşer. Borç, ek gelir ve tüm analiz kartları aynı şekilde etkilenir.
- **Seçenekler:**
  - A — Kayıt anında engelle: fişin para birimi uygulama para biriminden farklıysa kullanıcıya göster ve tutarı elle çevirmesini iste.
  - B — Tüm toplam sorgularına `AND currency = ?` ekle; diğer para birimindeki kayıtları ayrı göster.
- **Kabul kriteri:** PLN bütçesinde EUR para birimli bir harcama `totalSpent` değerini değiştirmez (B) veya kaydedilemez (A). Borç ve ek gelir için aynı test.
- **Doğrulama notu:** Sorun yalnız fişlerle sınırlı değil; para birimi kavramı uygulamada yarı etiket, yarı anahtar. `CurrencyContext.tsx:1` görüntüleme para birimini "tutarlar aynı kalır, sadece etiket" diye tanımlıyor, ama kuponlar ve devirler para birimine göre süzülüyor. Sonuçlar: (1) görüntüleme para birimi değiştirilirse eski kuponlar cüzdandan kaybolur (`deposit-wallet.tsx:88-91`) ve yeni harcamalarla eşleşmez (`containerDepositDao.ts:174-181`); (2) yeni bütçe satırı görüntüleme para birimini değil önceki bütçenin para birimini devralır (`settings-budget.tsx:263`); (3) tarayıcı sonuç kartı fişin para birimini gösterir ama uyarmadan kaydeder (`scanner.tsx:632`); (4) abonelik tespiti farklı para birimli tutarların ortalamasını alır (`subscriptionDetector.ts:130-136`). Karar verilirken "uygulama tek para birimli mi?" sorusu açıkça yanıtlanmalı; seçilen seçenek bu dört noktayı da kapsamalı.

### BUG-02 — Satıcı silme, kullanılmış kuponları öksüz bırakıyor

- **Önem:** Yüksek · **Güven:** Doğrulandı
- **Konum:** `src/db/vendorDao.ts:105-124`
- **Sorun:** `ExpenseDao.delete` ve `deleteMany`, harcamayı silmeden önce o harcamada kullanılmış kuponu `available` durumuna geri alıyor (`expenseDao.ts:172-177`). `VendorDao.deleteMany` aynı harcamaları doğrudan `DELETE FROM expenses` ile siliyor ve bu adımı atlıyor. Yabancı anahtar `redemption_expense_id` alanını `NULL` yapıyor ama `status = 'redeemed'` kalıyor.
- **Etki:** Kupon ne kullanılabilir ne de bir harcamaya bağlı; depozito cüzdanı bakiyesi kalıcı olarak yanlış.
- **Düzeltme:** `VendorDao.deleteMany` transaction'ının başına, silinecek harcamalar için aynı kupon geri alma `UPDATE` ifadesini ekle (`WHERE redemption_expense_id IN (SELECT id FROM expenses WHERE vendor_id IN (...))`). Tercihen bu mantığı tek bir paylaşılan yardımcıya taşı.
- **Kabul kriteri:** Kuponla ödenmiş harcaması olan satıcı silindiğinde kupon `available`, `redeemed_date` ve `redemption_expense_id` `NULL` olur.

### BUG-03 — Kalem düzenleme fişin basılı toplamını siliyor

- **Önem:** Orta · **Güven:** Doğrulandı · **Karar gerekli** (ADR-004 güncellemesi)
- **Konum:** `app/edit-items.tsx:97-111, 139-176, 193-196`; `src/db/expenseDao.ts:357-410`; `docs/decisions/ADR-004-receipt-total-integrity.md` madde 5, 8, 10
- **Sorun:** `edit-items` her kaydetmede `updateItemAndSyncTotal` çağırıyor ve bu çağrı başlık toplamını kalem toplamına eşitliyor. Üç senaryo:
  1. Yapay zekâ bir satırı atladı (başlık 68,80, kalemler 60,00). Kullanıcı yalnız bir kalemin adını düzeltir; toplam sessizce 60,00 olur ve bütçeden 8,80 kaybolur. ADR-004'ün amacıyla ve madde 8 ile ("başlık/kalem farkı sessizce düzeltilmez") çelişir.
  2. Son kalem silinir; harcama toplamı 0 olur.
  3. Elle girilmiş 50,00'lik kalemsiz harcamaya 5,00'lik ilk kalem eklenir; toplam 5,00 olur.
- **Doğrulama notu:** 2. ve 3. senaryo hata değil, belgelenmiş karardır. ADR-004 madde 5 "kalem ekler, siler veya fiyat/indirim değiştirirse … item toplamı kullanıcının yeni niyetidir" der; madde 10 ve `receiptParser.ts:165-168` yorumu aynı şeyi söyler; `src/db/__tests__/expenseDao.test.ts:265-280` düzenleme sonrası eşitlemeyi bekler. Yalnız 1. senaryo ADR'nin kapsam boşluğudur: ad değişikliği "fiyat/indirim değişikliği" değildir ama madde 10 "düzenleme" kelimesiyle onu da kapsıyor. Bu yüzden düzeltme bir kod yaması değil, önce ADR-004 kararıdır.
- **Ek sorunlar (doğrulandı):**
  - Ad düzeltmesi para alanlarını da yeniden yazıyor: form etiket birim fiyatını 4 ondalığa, miktarı 3 ondalığa yuvarlayıp satır toplamını yeniden hesaplıyor (`edit-items.tsx:101-110, 139-160`). Büyük miktarlarda (ör. 150 adet, toplam 100,00 → birim 0,6667 → 100,01) veya 4 ondalıklı tartılarda satır toplamı 1 kuruş değişebilir.
  - `edit-items` üst çubuğu yalnız kalem toplamını gösteriyor (`:204, 217-220`); başlık toplamı ve aradaki fark hiçbir yerde görünmüyor (ADR-004 madde 8: "UI gerekirse farkı gösterir").
- **Düzeltme:** Formda miktar, birim fiyat ve indirim değişmediyse `updateItem` çağrısına para alanlarını hiç gönderme ve `syncExpenseTotal` çağırma (yalnız `user_label` yaz). Başlık ile kalem toplamı farklıysa `edit-items` içinde farkı göster. 2. ve 3. senaryo için ürün sahibine sor: mevcut davranış kalsın mı, onay mı istensin? Kararı ADR-004'e işle ve ilgili testi güncelle.
- **Kabul kriteri:** Başlık toplamı kalem toplamından farklı bir fişte yalnız `user_label` değiştirildiğinde `expenses.total_amount` ve kalemin `total_price` değeri değişmez.

### BUG-04 — Alışveriş fişindeki kupon son kullanma tarihi doğrulanmıyor

- **Önem:** Yüksek · **Güven:** Doğrulandı (CHECK ihlalinin cihazdaki hata metni doğrulanmalı)
- **Konum:** `src/services/geminiService.ts:885-888, 941-949`; `src/services/receiptParser.ts:148-163`
- **Sorun:** `validateParsedReceipt`, `voucher_issued.expires_on` alanını yalnız `document_type === 'container_return_voucher'` dalında tarih olarak doğruluyor. Normal alışveriş fişinde bu alan yalnız 32 karaktere kırpılıp `container_deposit_vouchers` tablosuna yazılıyor. Tablo `length(expires_on) = 10` CHECK kısıtına sahip.
- **Etki:** Model `"31.12.2026"` döndürürse geçersiz biçimli tarih saklanır ve `expirePastDue` karşılaştırması yanlış çalışır. `"2026-12-31T00:00"` gibi 10 karakterden farklı bir değer döndürürse CHECK ihlali tüm fiş transaction'ını geri alır; kullanıcı yalnız genel "kaydedilemedi" mesajını görür.
- **Düzeltme:** `validateParsedReceipt` içinde, belge türünden bağımsız olarak `voucher_issued` varsa `expires_on` için `isSupportedYmd` ve `isVoucherDateRangeValid` kontrolü yap. Geçersizse fişi reddetme; `expires_on` alanını `null` yap.
- **Kabul kriteri:** `voucher_issued.expires_on = "31.12.2026"` içeren alışveriş fişi kaydedilir ve kuponun `expires_on` değeri `NULL` olur.
- **Doğrulama notu:** Etki yukarıdakinden büyük. `"31.12.2026"` gibi 10 karakterlik bozuk değer CHECK kısıtından geçer ve kalıcı olur. Kuponlar tarih aralığından bağımsız olarak her yedeğe yazıldığı için (`backupService.ts:964-980`) ve içe aktarım `expires_on` alanını kesin tarih olarak doğruladığı için (`:812`), o andan sonra alınan **tüm yedekler geri yüklenemez** (BUG-19). Kuponu silmenin arayüzde yolu yok (BUG-28). Aynı sonuç, biçimi doğru ama fiş tarihinden önceki bir son kullanma tarihinde de oluşur (`isVoucherDateRangeValid`, `:706`); düzeltme bu kontrolü de içermeli. Mevcut veritabanlarındaki bozuk satırları `NULL` yapan tek seferlik bir migration eklenmeli.

### BUG-05 — `withTransactionAsync` dışlayıcı değil

- **Önem:** Orta · **Güven:** Doğrulanmalı (expo-sqlite sözleşmesinden çıkarım; cihazda yeniden üretilmedi)
- **Konum:** `src/db/` ve `src/services/` içinde 30 çağrı; örnek `src/services/receiptParser.ts:110`, `src/services/backupService.ts:1485`
- **Sorun:** expo-sqlite belgelerine göre `withTransactionAsync` etkinken aynı bağlantıdan gelen her sorgu, kapsam fonksiyonunun dışından gelse bile transaction'a dahil olur. Uygulamada tek bağlantı var ve arka planda bağımsız yazılar çalışıyor (`syncSubscriptions`, `ContainerDepositDao.expirePastDue`, ayar yazıları).
- **Olası etkiler:**
  - Uzun bir transaction (yedek içe aktarımı) sırasında başka bir ekranın yazısı o transaction'a karışır; içe aktarım geri alınırsa o yazı da kaybolur.
  - İki `withTransactionAsync` üst üste gelirse ikincisi "cannot start a transaction within a transaction" hatası verir.
  - `src/notifications/storage.ts` ayrı bağlantıda `withExclusiveTransactionAsync` kullanıyor; ana bağlantıda uzun yazma transaction'ı varken kilit bekleyebilir.
- **Düzeltme:** Önce cihazda yeniden üret (içe aktarım sırasında harcama ekle). Doğrulanırsa tüm yazma transaction'larını tek bir süreç içi kuyruğa al; `storage.ts` içindeki mutation queue deseni örnek alınabilir. ADR-002 güncellenmeli.
- **Kabul kriteri:** İki eşzamanlı yazma işlemi sırayla çalışır; birinin geri alınması diğerini etkilemez.
- **Doğrulama notu (kütüphane kaynağından doğrulandı; cihazda yeniden üretilmedi):** `node_modules/expo-sqlite/src/SQLiteDatabase.ts:140-149` içinde `withTransactionAsync` yalnızca `BEGIN` → görev → `COMMIT`, hata olursa `ROLLBACK` çalıştırıyor. Bunun iki sonucu ilk yazılandan ağır:
  1. **İkinci transaction ilkini geri alıyor.** İkinci çağrının `BEGIN` ifadesi "cannot start a transaction within a transaction" hatası verir; onun `catch` bloğu `ROLLBACK` çalıştırır ve bu, aynı bağlantıdaki **ilk** transaction'ı geri alır. İlk işlem bundan habersiz devam eder; kalan ifadeleri transaction dışında tek tek kalıcılaşır, sonundaki `COMMIT` "no transaction is active" hatası verir. Sonuç yarım yazılmış veridir: `resetAllUserData` tabloların bir kısmını siler, `DebtDao.repay` ödeme satırı olmadan `remaining` değerini düşürür, içe aktarım kısmen uygulanır. Fiş kaydında yabancı anahtar hatası bunu engeller (kalemler var olmayan harcamaya bağlanamaz), diğerlerinde engel yok.
  2. **Bağlantılar arası kilit beklemesi yok.** `expo-sqlite` 55.0.20 kaynağında `busy_timeout` ayarı görünmüyor. `storage.ts:374, 448, 544` ayrı bağlantıda yazıyor; o sırada ana bağlantı yazma kilidini tutuyorsa (veya tersi) ikinci yazan beklemeden "database is locked" hatası alır. Bildirim senkronu her `triggerRefresh` çağrısından 300 ms sonra ve her uygulama dönüşünde çalıştığı için (`NotificationsContext.tsx:264-285`) bu, seyrek ve rastgele "kaydedilemedi" hatası olarak görünebilir.
- **Ana bağlantıdaki arka plan transaction'ı:** `RecurringPaymentReminderDao.advancePastDue` (`NotificationsContext.tsx:226`). Dosya seçiciden dönüş uygulamayı öne getirdiği için içe aktarım, bir bildirim senkronuyla hemen her zaman aynı anda başlar.
- **Ek düzeltme (ucuz, kuyruktan bağımsız):** Açılışta `PRAGMA busy_timeout = 3000` ayarla (`database.ts:410` yanında) ve `withExclusiveTransactionAsync` görevlerinin başında aynı PRAGMA'yı çalıştır.
- **Çağrı sayısı:** Ana bağlantıda 28 `withTransactionAsync` çağrısı var (31 çağrının 3'ü `storage.ts` web yedeği).

### BUG-06 — Toplu silme 500 kayıtta sessizce kesiliyor

- **Önem:** Orta · **Güven:** Doğrulandı
- **Konum:** `src/db/expenseDao.ts:183-202`; `app/(tabs)/transactions.tsx:255-266`
- **Sorun:** `deleteMany`, `sanitizeIdArray(ids, 500)` ile listeyi sessizce 500'e kırpıyor. Çağıran taraf bildirimde `ids.length` gösteriyor. Ayrıca 400'lük parçalar ayrı transaction'larda siliniyor; ikinci parça başarısız olursa ilk 400 silinmiş kalır.
- **Düzeltme:** Kırpma yerine tüm kimlikleri parçalara böl ve hepsini tek transaction içinde sil. `deleteMany` gerçekten silinen satır sayısını döndürsün; bildirim onu kullansın.
- **Kabul kriteri:** 600 kimlikle çağrıda 600 kayıt silinir; ortada enjekte edilen hata hiçbir kaydı silmez.

### BUG-07 — Veritabanı açılış hatası kalıcı

- **Önem:** Orta · **Güven:** Doğrulandı
- **Konum:** `src/db/database.ts:405-591`; `src/hooks/useDatabase.ts:13-24`; `app/_layout.tsx:382-390`
- **Sorun:** `initPromise` reddedilirse hiç sıfırlanmıyor; sonraki tüm `getDatabase()` çağrıları aynı reddedilmiş promise'i alır. Hata ekranında yeniden dene düğmesi yok ve ham `e.message` kullanıcıya gösteriliyor.
- **Düzeltme:** `initPromise` zincirine `catch` ekleyip hata durumunda `initPromise = null` yap ve hatayı yeniden fırlat. Hata ekranına çevrilmiş genel bir mesaj ve yeniden dene düğmesi ekle.
- **Kabul kriteri:** İlk `getDatabase()` çağrısı hata verdikten sonra ikinci çağrı yeni bir açma denemesi yapar.

### BUG-08 — UTC tabanlı "bugün" hesapları

- **Önem:** Orta · **Güven:** Doğrulandı
- **Konum:** `src/db/incomeDao.ts:18`; `app/(tabs)/analytics.tsx:279-283`; `src/services/subscriptionDetector.ts:57-61, 155`; `src/db/expenseDao.ts:916`
- **Sorun:** Bu noktalar `toISOString()` veya SQLite `date('now')` kullanıyor; ikisi de UTC'dir. `dateUtils.ts` içindeki `getToday()` tam bu hatayı önlemek için yazılmış ama buralarda kullanılmıyor. Polonya'da (UTC+1/+2) gece 00:00–02:00 arasında "bugün" bir önceki gün çıkar.
- **Ek:** `analytics.tsx:280` içindeki `d.setMonth(d.getMonth() - 1)` ayın 31'inde taşar (31 Mart → 3 Mart).
- **Düzeltme:** Hepsini `getToday()` ve `dateUtils` içindeki yerel yardımcılarla değiştir. `getPriceHistory` için başlangıç tarihini JS'te yerel olarak hesaplayıp parametre olarak geçir.
- **Kabul kriteri:** Sistem saati yerel 00:30 iken (UTC'de önceki gün) `IncomeDao.create` geçersiz tarihte yerel bugünü yazar.
- **Doğrulama notu:** Gerçek etkisi olan iki nokta `analytics.tsx:279-283` (özel aralığın başlangıç değerleri ve ay sonu taşması) ile `incomeDao.ts:18`'dir (yalnız geçersiz tarih geldiğinde devreye giren yedek değer). `subscriptionDetector.ts:57-61` yerel öğle saatini kullandığı için UTC±12 içindeki saat dilimlerinde doğru sonuç verir; `:155` ve `expenseDao.ts:916` yalnız 220 günlük ve 6 aylık pencerelerin sınırını en çok bir gün kaydırır. Bu üçü tutarlılık için düzeltilebilir ama kullanıcıya görünen bir hata üretmez.

### BUG-09 — Hedef ve kategori limiti yazıları

- **Önem:** Orta · **Güven:** Doğrulandı
- **Konum:** `src/db/categoryLimitDao.ts:20-29`; `src/db/goalDao.ts:37-78`; `app/goal-settings.tsx:128-155`
- **Sorunlar:**
  - `CategoryLimitDao.upsert` önce `DELETE`, sonra `INSERT` çalıştırıyor; transaction yok. `limitAmount` `NaN` ise `NaN > 0` yanlış olduğu için limit sessizce silinir.
  - `GoalDao.upsert` başlık uzunluğu, tutar, tarih ve para birimi için `inputValidation` kullanmıyor (`AGENTS.md` kuralı).
  - `GoalDao.addContribution` oku-hesapla-yaz yapıyor; hızlı çift dokunuşta bir katkı kaybolabilir. Toplam `roundMoney` ile yuvarlanmıyor.
  - `goal-settings` kaydetme akışı hedef yazısı, limit silmeleri ve limit yazılarını ayrı ayrı çalıştırıyor; ortada hata olursa yarım kayıt kalır.
- **Düzeltme:** `upsert` için `INSERT ... ON CONFLICT(category_id, month) DO UPDATE`; tutarları `sanitizeAmount`, tarihleri `sanitizeDate` ile doğrula. `addContribution` için tek ifade: `UPDATE savings_goal SET current_amount = MAX(0, ROUND(current_amount + ?, 2))`. Ekranın kaydetme akışını tek transaction'lı bir DAO fonksiyonuna taşı.
- **Kabul kriteri:** `upsert(id, month, NaN)` hata fırlatır ve mevcut limit durur. Kaydetme ortasında enjekte edilen hata hiçbir satırı değiştirmez.

### BUG-10 — `ExpenseDao.create/update` doğrulama eksikleri

- **Önem:** Orta · **Güven:** Doğrulandı
- **Konum:** `src/db/expenseDao.ts:118-167`
- **Sorun:** `create` tarihi doğrulamadan yazıyor. `update` para birimi, not, `receipt_uri` ve tarihi hiç temizlemiyor; `create` aynı alanların bir kısmını temizliyor. Şemada `expenses.date` ve `total_amount` için CHECK kısıtı yok.
- **Düzeltme:** İki fonksiyonda da `sanitizeDate` (geçersizse hata fırlat), `sanitizeText(currency, 10)`, `sanitizeText(note, 1000)` kullan.
- **Kabul kriteri:** `update(id, { date: '2026-13-45' })` hata fırlatır; `update(id, { note: <2000 karakter> })` 1000 karakter yazar.
- **Doğrulama notu:** Not alanının arayüzde uzunluk sınırı yok (`add-expense.tsx:479-486`). Düzenleme modunda 1000 karakteri aşan bir not veritabanına olduğu gibi yazılır; içe aktarım notu 1000 karakterle sınırladığı için (`backupService.ts:442`) o harcamayı içeren yedek tümüyle reddedilir (BUG-19). `ExpenseDao.update` yalnız `add-expense.tsx:242` tarafından çağrılıyor.

### BUG-11 — İşlem araması yalnız yüklenmiş sayfalarda çalışıyor

- **Önem:** Orta · **Güven:** Doğrulandı
- **Konum:** `app/(tabs)/transactions.tsx:282-290`; `src/hooks/useExpenses.ts:35-87`
- **Sorun:** Liste 60'lık sayfalarla yükleniyor ve arama yalnız bellekteki satırları süzüyor. Henüz yüklenmemiş eski bir harcama aramada çıkmaz; kullanıcı kaydın var olmadığını düşünür.
- **Düzeltme:** Arama metni doluyken `ExpenseDao` üzerinde `LIKE` tabanlı, sayfalı bir sorgu kullan. SQLite `LOWER` yalnız ASCII harfleri çevirir (bkz. BUG-14); karşılaştırma için normalize edilmiş bir yol seç.
- **Kabul kriteri:** 200 harcamalı veritabanında en eski kaydın satıcı adı aramada bulunur.

### BUG-12 — ADR-002 ihlalleri

- **Önem:** Orta · **Güven:** Doğrulandı (çökme riski doğrulanmalı)
- **Konum:** `app/(tabs)/index.tsx:118-130`; `src/hooks/useSavingsGoalData.ts:64-67`; `app/goal-settings.tsx:66-70`; `src/services/backupMeta.ts:55-62, 83-89`
- **Sorun:** ADR-002 aynı bağlantıda `Promise.all` ile paralel sorguyu yasaklıyor ("shared object already released" çökmesi nedeniyle). Bu dört nokta hâlâ paralel çalışıyor. Analiz ekranı aynı sorunu seri kuyrukla çözmüş (`analytics.tsx:1028`).
- **Ek sorunlar:**
  - Dashboard `onRefresh` içinde `try/finally` yok; bir yenileme hata verirse çekme göstergesi sonsuza dek döner.
  - `useCategoryLimitsProgress` içinde `catch` ve unmount koruması yok.
  - `recordBackupSuccess` beş ayrı yazıyı transaction dışında yapıyor.
- **Düzeltme:** Çağrıları seri `await` zincirine çevir; `recordBackupSuccess` yazılarını tek transaction'a al; `onRefresh` için `try/finally` ekle.
- **Kabul kriteri:** Bu dosyalarda veritabanına dokunan `Promise.all` kalmaz.
- **Doğrulama notu:** Dashboard'daki asıl kaynak `Promise.all` değil. `refreshAll` (`app/(tabs)/index.tsx:90-98`) aynı yedi yenileme zincirini beklemeden art arda başlatıyor ve her odaklanmada (`:100-104`) ve her veri değişikliğinde (`:116`) çalışıyor. Yalnız `onRefresh` düzeltilirse eşzamanlılık aynen kalır. Düzeltme `refreshAll` için de tek bir seri kuyruk kullanmalı (`analytics.tsx` içindeki `refreshQueueRef` deseni). Kabul kriterine ekle: `refreshAll` içindeki zincirler sırayla çalışır.

### BUG-13 — Kullanımdaki kategori silinemiyor

- **Önem:** Orta · **Güven:** Doğrulandı
- **Konum:** `src/db/categoryDao.ts:47-57`; `src/db/schema.ts` (`expenses.category_id`, `expense_items.category_id`); `app/categories.tsx:80-94`
- **Sorun:** `expenses.category_id` ve `expense_items.category_id` için `ON DELETE` eylemi tanımlı değil. Harcaması olan bir kategoriyi (veya alt kategorisinde harcama olan bir üst kategoriyi) silmek yabancı anahtar hatası verir; kullanıcı yalnız genel "işlem başarısız" mesajını görür.
- **Düzeltme:** `CategoryDao.delete` içinde önce kullanım sayısını kontrol et ve özel bir hata kodu fırlat (`CATEGORY_IN_USE`); ekranda nedenini açıklayan çevrilmiş mesaj göster. Kayıtları "Diğer" kategorisine taşıma seçeneği ürün kararıdır.
- **Kabul kriteri:** Harcaması olan kategori silinmeye çalışıldığında `CATEGORY_IN_USE` hatası döner ve kategori durur.

### BUG-14 — ASCII dışı harflerde kopya satıcı ve kategori

- **Önem:** Düşük · **Güven:** Doğrulandı
- **Konum:** `src/db/vendorDao.ts:20-26, 43-55`; `src/db/categoryDao.ts:59-65`
- **Sorun:** Eşleme `LOWER(name) = LOWER(?)` ile yapılıyor; SQLite `LOWER` yalnız ASCII harfleri çevirir. "ŻABKA" ile "Żabka", "ŞOK" ile "Şok" ayrı satıcı olur. `vendors.name` üzerinde UNIQUE kısıtı da yok; kontrol ve ekleme ayrı adımlar.
- **Düzeltme:** JS tarafında normalize edilmiş bir anahtar üret (`toLocaleLowerCase` ve NFKC) ve ayrı bir `name_key` kolonunda UNIQUE indeksle sakla. Migration ve backup biçimi birlikte değerlendirilmeli.
- **Kabul kriteri:** `findOrCreate('ŻABKA')` ardından `findOrCreate('żabka')` aynı kimliği döndürür.
- **Doğrulama notu:** İçe aktarım satıcıları JS `toLowerCase()` ile eşliyor (`backupService.ts:1562-1568`), canlı yol SQLite `LOWER` ile. Bu yüzden kopya satıcılar oluştuktan sonra aynı yedeğin tekrar içe aktarımı, eski kopyaya bağlı harcamaları yinelenen kayıt olarak tanımaz ve ikinci kez ekler (BUG-21). Mevcut kopyaları birleştiren bir migration da gerekli.

### BUG-15 — `add-expense` işleyicileri

- **Önem:** Düşük · **Güven:** Doğrulandı (çift kayıt cihazda doğrulanmalı)
- **Konum:** `app/add-expense.tsx:209-284, 351-357`
- **Sorun:** `handleDeleteConfirm` içinde `try/catch` yok; silme hata verirse yakalanmamış promise reddi oluşur ve kullanıcı geri bildirim almaz. `handleSave` ve `handleDetailedEdit` yalnız `saving` state'iyle (düğmenin `disabled` özelliği) korunuyor; state güncellenmeden gelen ikinci dokunuş ikinci kaydı oluşturabilir. Tarayıcı ekranı aynı sorunu ref ile çözmüş (`scanner.tsx:409-411`).
- **Düzeltme:** `savingRef` ekle ve işleyicilerin başında kontrol et; silme işleyicisine `try/catch` ve hata bildirimi ekle.

### BUG-16 — "İhtiyaç/İstek" ayrımı Türkçe adlara sabit

- **Önem:** Düşük · **Güven:** Doğrulandı
- **Konum:** `src/db/expenseDao.ts:534-552`; `src/hooks/useExpenses.ts:406-418`
- **Sorun:** Sorgu kategori adlarını Türkçe sabitlerle karşılaştırıyor (`'Faturalar'`, `'Sağlık'` vb.) ve segment etiketlerini Türkçe döndürüyor. Kullanıcının eklediği veya yedekten gelen farklı adlı kategoriler her zaman "Diğer" segmentine düşer.
- **Düzeltme:** Segmenti kategori satırında dil bağımsız bir alanla tut veya `receiptCategory.ts` içindeki anahtarlar üzerinden eşle; sorgu `needs | wants | other` döndürsün.

### BUG-17 — Gemini katmanında küçük tutarsızlıklar

- **Önem:** Düşük · **Güven:** Doğrulandı
- **Konum:** `src/services/geminiService.ts`
- **Maddeler:**
  - `:124-138, 177` — Anahtar değişirken süren model keşfi tamamlandığında eski anahtarın model listesi yeni anahtar için 5 dakika önbellekte kalır. `resetGeminiModelState` içinde bir nesil sayacı artır; keşif sonucu yalnız nesil değişmediyse önbelleğe yazılsın.
  - `:163, 181-185` — Başarılı HTTP yanıtında `JSON.parse` hatası `AI_NETWORK` olarak sınıflanıyor; `AI_INVALID_RESPONSE` olmalı.
  - `:818` — Miktar 0 gelirse 0,001'e çekiliyor ve birim fiyat `toplam / 0,001` oluyor. 0 veya negatif miktarı 1 kabul et.
  - `:806-812` — 500'den fazla kalem sessizce kırpılıyor; kullanıcı kalem toplamı ile fiş toplamı arasındaki farkın nedenini görmüyor.
  - `:1045` — `cleanAndParseResponse` düz `Error` fırlatıyor; diğer yollar `GeminiServiceError` kullanıyor.
  - `src/utils/inputValidation.ts:57-61` — 2100 yılına kadar gelecek tarihler geçerli sayılıyor; modelin yanlış okuduğu yıl (ör. 2062) kaydedilebilir. Fiş tarihi için bugünden ileri bir üst sınır değerlendirilmeli (**karar gerekli**).

### BUG-18 — Migration hijyeni

- **Önem:** Düşük · **Güven:** Doğrulandı
- **Konum:** `src/db/database.ts:429-489, 693-710`
- **Sorun:** `seedDefaultCategories` 60 ekleme yapıyor (10 kök, 50 alt kategori) ve transaction içinde değil (`AGENTS.md` çoklu yazma kuralı). Eski `ALTER TABLE` adımları her hatayı yutuyor (`catch (_) {}`); "kolon zaten var" dışındaki gerçek hatalar da sessizce geçiliyor.
- **Düzeltme:** Tohumlamayı transaction'a al. `ALTER` adımlarını dosyadaki diğer migration'lar gibi `PRAGMA table_info` kontrolüne çevir (bkz. PERF-06).

### BUG-19 — Dışa aktarım kendi çıktısını doğrulamıyor

- **Önem:** Yüksek · **Güven:** Doğrulandı (her tetikleyicinin kod yolu okundu; cihazda yeniden üretilmedi)
- **Konum:** `src/services/backupService.ts:883-1303` (`buildBackupPayload`), `:1321-1342` (`exportBackupToFile`), `:740-881` (`validateAndNormalizeBackupPayload`), `:63-65` (sınırlar)
- **Sorun:** İçe aktarım katı bir sözleşme uyguluyor ve tek ihlalde dosyanın tamamını `INVALID_FORMAT` ile reddediyor. Dışa aktarım ise veritabanında ne varsa yazıyor; ürettiği dosyayı aynı sözleşmeye göre denetlemiyor. Veritabanında sözleşme dışı tek bir satır olması, o satırı içeren her yedeği geri yüklenemez yapar ve kullanıcı bunu ancak geri yüklemeye çalıştığında öğrenir.
- **Sözleşme dışı satır üreten doğrulanmış yollar:**
  - Bozuk veya fiş tarihinden önceki kupon son kullanma tarihi (BUG-04). Kuponlar aralıktan bağımsız her yedeğe girer.
  - Düzenleme modunda 1000 karakteri aşan harcama notu (BUG-10).
  - Boyut sınırları: içe aktarım 25 MB, koleksiyon başına 100.000 satır ve toplam 250.000 kalem kabul ediyor; dışa aktarımda karşılığı yok. Çıktı girintili yazıldığı için (`:1324`) kalem başına yaklaşık 600 bayt tutar; kabaca 40.000 kalemden sonra dosya 25 MB'ı aşar (tahmin, ölçülmedi).
- **Etki:** Yedek alındı görünür, "son yedek" kaydı güncellenir, hatırlatıcı susar; dosya geri yüklenemez.
- **Düzeltme:** `exportBackupToFile` içinde dosyayı teslim etmeden önce `validateAndNormalizeBackupPayload(JSON.parse(json))` çalıştır ve boyutu `MAX_BACKUP_FILE_BYTES` ile karşılaştır. Başarısızsa dosyayı paylaşma, `recordBackupSuccess` çağırma ve kullanıcıya hangi kayıt türünün sorunlu olduğunu söyleyen çevrilmiş bir mesaj göster. Doğrulayıcının hata kodunu alan adıyla zenginleştir (ör. `INVALID_FORMAT:voucher.expires_on`).
- **Kabul kriteri:** `expires_on = '31.12.2026'` olan bir kupon içeren veritabanında dışa aktarım hata döndürür ve dosya üretmez. Geçerli veritabanında üretilen her çıktı `validateAndNormalizeBackupPayload` kontrolünden geçer (mevcut gidiş-dönüş testlerine eklenir).

### BUG-20 — İçe aktarım, yerelde değişmiş kayıtları "geçersiz dosya" diye reddediyor

- **Önem:** Orta · **Güven:** Doğrulandı · **Karar gerekli**
- **Konum:** `src/services/backupService.ts:1638-1645` (ürün meta verisi), `:1692-1694` (alias sahibi), `:1899-1917` (kalem parmak izi ve `user_label`), `:2074-2087` (kupon), `:2498-2518` (hatırlatıcı); `src/components/BackupSection.tsx:264-272`
- **Sorun:** UID taşıyan kayıtlarda (ürün, alias, kupon, hatırlatıcı) ve yinelenen harcamanın kalemlerinde yerel satır yedekteki satırla birebir aynı değilse içe aktarım `INVALID_FORMAT` fırlatıp tüm işlemi geri alıyor. Bu kasıtlı bir "çakışmada dur" tasarımı (`backupService.test.ts:953, 964, 1080, 1113` reddi bekliyor), ama farkı üreten olaylar sıradan ve bir kısmı otomatik:
  - Kuponun süresi doldu: `expirePastDue` durumu `expired` yapar (`containerDepositDao.ts:54-64`). Kuponlar her yedekte bulunduğu için, son kullanma tarihli kupon içeren her yedek o tarihten sonra aynı cihaza alınamaz.
  - Hatırlatıcının vadesi geçti: `advancePastDue` `next_due_date` ve `updated_at` alanlarını ilerletir (`recurringPaymentReminderDao.ts:230-280`). Hatırlatıcılar da her yedekte bulunur; aylık bir hatırlatıcısı olan kullanıcı bir aydan eski yedeğini aynı cihaza alamaz.
  - Kupon bir alışverişte kullanıldı, ürün yeniden adlandırıldı, birleştirildi veya ayrıldı (`productIdentityDao.ts:355-479`, `updated_at` değişir), bir kalemin etiketi ikinci kez düzenlendi.
- **Etki:** Kullanıcı yanlışlıkla sildiği harcamaları eski yedekten geri getirmek istediğinde "geçersiz dosya biçimi" mesajı görür; dosya geçerlidir. Tek çıkış yolu tüm veriyi sıfırlamaktır.
- **Seçenekler:**
  - A — Çakışmayı ayrı bir hata koduyla (`BACKUP_CONFLICT`) ve nedeni söyleyen çevrilmiş mesajla bildir; davranış aynı kalır.
  - B — Otomatik veya türetilmiş alanlarda (kupon `status`/`redeemed_date`, hatırlatıcı `next_due_date`/`updated_at`, ürün `updated_at`) "yerel kayıt kazanır, satırı atla" uygula; gerçek içerik çakışmasında A'ya düş.
- **Kabul kriteri (B):** Yedek alındıktan sonra süresi dolan kupon ve vadesi ilerleyen hatırlatıcı bulunan veritabanına aynı yedek içe aktarılır; ikisi de "atlandı" sayılır ve işlem başarıyla biter.

### BUG-21 — Harcama ve borçlarda kalıcı kimlik yok

- **Önem:** Orta · **Güven:** Doğrulandı · **Karar gerekli** (şema ve yedek biçimi değişir)
- **Konum:** `src/services/backupService.ts:1744-1779` (`expenseKey`), `:1972-1981`, `:2165-2191` (`debtKey`), `:2262-2297`, `:1541-1555` (`nameToId`); `app/categories.tsx:63-73`
- **Sorun:** Harcama, borç, ödeme ve ek gelir için taşınabilir kimlik yok; yinelenen kayıt tespiti içerik anahtarıyla yapılıyor. Anahtardaki bir alan yerelde değişirse aynı kayıt tanınmaz ve ikinci kez eklenir.
- **Doğrulanmış senaryolar:**
  - Yedekten sonra tutarı, kategorisi, satıcısı veya notu değişen harcama, eski yedek alındığında ikinci kayıt olarak eklenir; bütçe iki kez düşer.
  - Hatırlatıcısı açıkken yedeklenen borç sonradan tamamen ödenirse `reminder_enabled` sıfırlanır (`debtDao.ts:176-185`) ve anahtar değişir. Eski yedek alındığında borç "açık" olarak ikinci kez eklenir; `borrowedIn` ve açık borç toplamı iki katına çıkar. Vade veya hatırlatma ayarı değişikliği de aynı sonucu verir.
  - Aynı adlı iki kategori veya BUG-14'teki kopya satıcılar varsa aynı dosyanın tekrar içe aktarımı bile harcamaları çoğaltır. Yedek, kategoriyi yalnız adıyla taşır; içe aktarım aynı adı tek bir kimliğe indirger (`nameToId`), bu kimlik harcamanın gerçek kategorisinden farklıysa anahtar tutmaz. Kategori ekranı aynı adla ikinci kategori açılmasını engellemiyor.
- **Düzeltme:** `expenses`, `debts`, `debt_payments`, `extra_incomes` tablolarına `uid` kolonu ekle (migration ile mevcut satırlara UUID üret), yedek biçimini v7 yap ve eşleştirmeyi önce `uid` ile, v6 ve öncesi için mevcut içerik anahtarıyla yap. Kategori için harcama ve kalemde üst kategori adını da taşı. Kategori oluştururken aynı üst altında aynı adı reddet.
- **Kabul kriteri:** v7 yedeği alındıktan sonra tutarı değiştirilen harcama, aynı yedek içe aktarıldığında çoğalmaz. Tam ödenmiş borç ikinci kez eklenmez.

### BUG-22 — Kategori limitleri üç farklı dönem tanımıyla okunuyor

- **Önem:** Orta · **Güven:** Doğrulandı · **Karar gerekli** (devralma kuralı)
- **Konum:** `app/goal-settings.tsx:30-33, 60, 144-154`; `src/hooks/useSavingsGoalData.ts:42-57`; `app/(tabs)/analytics.tsx:743-748`; `src/notifications/buildNotifications.ts:153, 197-203`; `DESIGN_BRIEF.md` §5.3; `docs/ARCHITECTURE.md:166`
- **Sorun:** Tasarım belgesi kategori limitlerinin bütçe döngüsüyle ortak dönem sınırını kullanmasını şart koşuyor. Kodda limit anahtarı ve harcama aralığı dört yerde farklı seçiliyor:

  | Yer | Limit anahtarı | Harcama aralığı |
  |---|---|---|
  | Limit ayarı (yazma ve okuma) | Bugünün takvim ayı | — |
  | Dashboard | Bugünün takvim ayı | Seçili bütçe döngüsü |
  | Analiz | Bugünün takvim ayı | Takvim ayı |
  | Bildirimler | Döngünün başladığı ay | Bütçe döngüsü |

- **Etki:**
  - Döngü günü 1 değilse bildirimler arayüzde görünen limitlerden farklı bir ayın limitlerine bakar. Örnek: döngü 23 Ekim–22 Kasım, bugün 11 Kasım; limit `2026-11` altında kayıtlı, bildirim `2026-10` anahtarını okur ve hiçbir limit uyarısı üretmez. Analiz ve Dashboard aynı limiti farklı harcama aralıklarıyla karşılaştırır.
  - Dashboard'da geçmiş bir döngüye gidildiğinde bugünkü ayın limitleri o döngünün harcamasıyla karşılaştırılır.
  - Hiçbir yerde devralma yok: her ayın 1'inde limit listesi boşalır ve kullanıcı limitleri baştan girmek zorunda kalır. Bu, döngü günü 1 olan kullanıcıları da etkiler.
- **Düzeltme:** Limit dönemini tek bir yardımcıda çöz (bugünü kapsayan bütçe döngüsünün anahtarı ve aralığı) ve dört yeri ona bağla. Dashboard'da seçili döngünün anahtarını kullan. Yeni döngüde limit yoksa önceki döngünün limitlerini devralıp devralmamayı ürün sahibine sor.
- **Kabul kriteri:** Döngü günü 23 iken kaydedilen limit için Dashboard, Analiz ve bildirim motoru aynı limit satırını ve aynı tarih aralığını kullanır.

### BUG-23 — Varsayılan 5000 PLN bütçe geri geliyor

- **Önem:** Orta · **Güven:** Doğrulandı · **Karar gerekli** (varsayılan bütçe olmalı mı)
- **Konum:** `src/db/database.ts:677-690`; `src/db/budgetDao.ts:116-128`; `src/services/dataReset.ts:64, 125-138`; `app/onboarding.tsx:65-68`
- **Sorun:** `seedIfNeeded` her açılışta çalışıyor ve aktif bütçe satırı yoksa içinde bulunulan takvim ayı için 5000 PLN'lik bütçe ekliyor. Bu kontrol ilk kurulumu "hiç bütçe yok" durumundan ayırmıyor.
- **Etki:**
  - Kullanıcı tek bütçesini siler ("dönem bütçesiz görünür"); uygulama yeniden açıldığında 5000 PLN bütçe geri gelir.
  - Veri sıfırlama tüm bütçeleri siler; sonraki açılışta kullanıcının hiç girmediği bir bütçe belirir ve bütçe bildirimleri ona göre üretilir.
  - Onboarding'i atlayan veya bütçe girmeyen kullanıcı, seçtiği para biriminden bağımsız 5000'lik bir bütçeyle başlar; satır PLN olarak kayıtlıdır ve döngü günü 1'dir.
- **Düzeltme:** Tohumlamayı tek seferlik bir `settings` bayrağına bağla veya tamamen kaldır (onboarding bütçe adımı zaten var). Hangisi olacağını ürün sahibine sor.
- **Kabul kriteri:** Tek bütçe silinip `getDatabase()` yeniden başlatıldığında aktif bütçe sayısı 0 kalır.

### BUG-24 — Tutar alanlarında tutarsız ayrıştırma

- **Önem:** Orta · **Güven:** Doğrulandı
- **Konum:** `src/components/DebtSheet.tsx:52-54, 231, 274`; `src/components/IncomeSheet.tsx:45-47, 110`; `src/components/SavingsGoalContributionSheet.tsx:47`; `app/goal-settings.tsx:118, 129, 270-283`; `app/onboarding.tsx:78-79`; `app/edit-items.tsx:119`
- **Sorun:** Harcama, bütçe, kupon ve devir alanları katı `parseMoneyInput` kullanıyor ve hatalı girdiyi reddediyor. Borç, borç ödemesi, ek gelir, hedef tutarı, hedef katkısı ve onboarding bütçesi `parseFloat` kullanıyor; `parseFloat` ilk geçersiz karakterde durur ve o ana kadarki sayıyı döndürür.
  - `"1.500"` (bin beş yüz) 1,5 olarak; `"1 250,50"` 1 olarak; `"1.250,50"` 1,25 olarak kaydedilir.
  - Kategori limiti alanı sayıyı her tuşta ayrıştırıp geri yazıyor (`value={String(row.limit_amount)}`). Ondalık ayraç yazılamıyor: `12,5` yazmak 125 kaydediyor.
- **Etki:** Borç ve ek gelir bütçeyi doğrudan değiştirdiği için yanlış tutar sessizce bütçeye yansır. Başarı bildirimi kaydedilen tutarı gösteriyor ama girişi engellemiyor.
- **Düzeltme:** Bu alanların hepsinde `parseMoneyInput` kullan ve `null` dönerse `invalid_amount` göster. Limit alanında ham metni state'te tut, sayıya yalnız kaydederken çevir.
- **Kabul kriteri:** Borç formunda `"1.500"` girişi `invalid_amount` hatası verir. Limit alanına `12,5` yazılıp kaydedildiğinde 12,5 saklanır.

### BUG-25 — İşlem listesi her odaklanmada ilk 60 kayda sıfırlanıyor

- **Önem:** Düşük · **Güven:** Doğrulandı (kaydırma konumunun davranışı cihazda doğrulanmalı)
- **Konum:** `src/hooks/useExpenses.ts:49-64`; `app/(tabs)/transactions.tsx:107-109`; `src/db/expenseDao.ts:72`
- **Sorun:** `refresh` her çağrıda yalnız ilk sayfayı çekip listeyi onunla değiştiriyor. Ekran her odaklandığında ve her veri değişikliğinde çağrılıyor. Kullanıcı 300. sıradaki eski bir kaydı düzenleyip geri döndüğünde liste 60 kayda iner ve bulunduğu yer kaybolur.
- **Ek:** Sıralama `date DESC, created_at DESC`; benzersiz bir son anahtar yok. İçe aktarılan kayıtlarda aynı `date` ve `created_at` çiftleri bulunabilir; `OFFSET` ile sayfalamada satır iki sayfada birden görünebilir veya atlanabilir.
- **Düzeltme:** `refresh`, `max(pageSize, yüklü satır sayısı)` kadar satır çeksin. `ORDER BY` sonuna `e.id DESC` ekle.
- **Kabul kriteri:** 180 satır yüklüyken `refresh` sonrası liste 180 satır içerir.

### BUG-26 — Tarayıcıda depozito kuponu "Düzenle" düğmesiyle kaydediliyor

- **Önem:** Düşük · **Güven:** Doğrulandı
- **Konum:** `app/(tabs)/scanner.tsx:451-456, 755-792`
- **Sorun:** Sonuç bir depozito kuponuysa "Kaydet" düğmesi gizleniyor; geriye "Düzenle" ve "İptal" kalıyor. "Düzenle" düğmesi kupon için doğrudan `handleSave` çağırıyor. Kullanıcı düzenleme ekranı beklerken kupon kaydedilir.
- **Düzeltme:** Koşulu ters çevir: kupon sonucunda "Kaydet" görünsün, "Düzenle" gizlensin.
- **Kabul kriteri:** Kupon sonucunda `save` etiketli düğme görünür ve `edit` etiketli düğme görünmez.

### BUG-27 — Satıcı logosu önbellekteki geçici dosyaya işaret ediyor

- **Önem:** Düşük · **Güven:** Doğrulanmalı (kod yolu okundu; önbellek temizliği cihazda denenmedi)
- **Konum:** `app/settings-data.tsx:121-131`; `src/db/vendorDao.ts:57-60`; `src/services/temporaryFiles.ts:3-9`
- **Sorun:** Logo seçildiğinde görsel seçicinin döndürdüğü adres doğrudan `vendors.logo_uri` alanına yazılıyor. Bu adres uygulamanın önbellek dizinindeki bir kopyadır; işletim sistemi yer açmak için veya kullanıcı "önbelleği temizle" dediğinde siler. iOS'ta uygulama güncellemesi kapsayıcı yolunu değiştirebilir.
- **Etki:** Logolar önceden haber vermeden kaybolur; satıcı baş harf avatarına döner. Değiştirilen veya satıcısı silinen logoların dosyaları da temizlenmiyor.
- **Düzeltme:** Seçilen görseli `documentDirectory/vendor-logos/` altına kopyala ve o yolu sakla; logo değiştiğinde ve satıcı silindiğinde eski dosyayı sil. Mevcut kayıtlar için dosya hâlâ duruyorsa kopyalayan bir geçiş adımı ekle.

### BUG-28 — Depozito kuponu silinemiyor

- **Önem:** Düşük · **Güven:** Doğrulandı · **Karar gerekli**
- **Konum:** `app/deposit-wallet.tsx:87-92, 218-245`; `src/db/containerDepositDao.ts` (silme veya düzeltme işlevi yok)
- **Sorun:** Cüzdanda kupon için tek eylem "alışverişte kullan". Yanlış tutarla eklenen, yapay zekânın hatalı okuduğu veya BUG-04 ile bozuk tarih almış bir kuponu silmenin ya da düzeltmenin yolu yok; tek çare tüm veriyi sıfırlamak. Ayrıca liste yalnız görüntüleme para birimindeki kuponları gösteriyor; başka para birimiyle kaydedilmiş kupon (BUG-01) veritabanında durur ama hiçbir ekranda görünmez.
- **Düzeltme:** `available` ve `expired` durumundaki kuponlar için onaylı silme ekle (`redeemed` kuponlar harcamaya bağlı olduğu için silinmemeli). Başka para birimindeki kuponları ayrı bir başlık altında göster.

### BUG-29 — `edit-items` ek sorunları

- **Önem:** Düşük · **Güven:** Doğrulandı
- **Konum:** `app/edit-items.tsx:113-186, 348-353`; `src/db/containerDepositDao.ts:80-84`
- **Maddeler:**
  - Depozito kalemi (`financial_kind = 'container_deposit'`) düzenlendiğinde veya silindiğinde `expenses.container_deposit_paid` güncellenmiyor. Cüzdandaki "ödenen depozito" toplamı bu başlık alanından hesaplandığı için kalemlerle ayrışır.
  - Kalem silme veya düzeltme toplamı kullanılan kupon tutarının altına düşürürse `syncExpenseTotal` `INVALID_CONTAINER_RECOVERY` fırlatır (`expenseDao.ts:373`); kullanıcı yalnız genel "işlem başarısız" mesajını görür.
  - `handleSaveItem` için kaydetme koruması yok; düğme `disabled` bile olmuyor. Hızlı çift dokunuş aynı kalemi iki kez ekleyebilir (BUG-15 ile aynı desen).
- **Düzeltme:** Kalem yazımından sonra aynı transaction içinde `container_deposit_paid` değerini depozito kalemlerinin toplamından yeniden hesapla. Kupon sınırı hatası için çevrilmiş özel mesaj göster. `savingRef` ekle.

### BUG-30 — Küçük arayüz ve dayanıklılık düzeltmeleri

- **Önem:** Düşük · **Güven:** Doğrulandı (son madde doğrulanmalı)
- **Maddeler:**
  - `src/components/DataResetSection.tsx:63-80` — Sıfırlamadan sonra `triggerRefresh` çağrılmıyor. Aynı ekrandaki satıcı listesi `refreshKey` ile yüklendiği için (`app/settings-data.tsx:106-108`) silinmiş satıcıları göstermeye devam eder.
  - `app/categories.tsx:48-73` — `loadTree` ve `handleAdd` içinde hata yakalama yok; ekleme başarısız olursa kullanıcı geri bildirim almaz.
  - `src/components/IncomeSheet.tsx:109-137` — Kaydetme yalnız state ile korunuyor; `DebtSheet` aynı işi `savingRef` ile yapıyor.
  - `src/services/backupService.ts:1397` — Paylaşım başlığı sabit İngilizce (`'S.P.A.R.K. backup'`); `AGENTS.md` i18n kuralına aykırı.
  - `src/services/receiptLineMerge.ts:19-27` — İndirim satırı sezgisi adında `promo`, `promocja`, `rabat` geçen pozitif fiyatlı gerçek bir ürünü de indirim sayıp bir önceki ürünün fiyatından düşebilir ve ürünü listeden çıkarır. Yalnız negatif tutarlı veya tutarsız satırlarda ad eşleşmesine güvenilmeli. Gerçek fişlerle doğrulanmalı.

### BUG-31 — Yedek kapsamı ve "tam yedek" eksikliği

- **Önem:** Orta · **Güven:** Doğrulandı · **Karar gerekli**
- **Konum:** `src/services/backupService.ts:883-1303`; `src/components/BackupSection.tsx:79-81, 140-161, 187-198, 305-329`; `docs/ARCHITECTURE.md` "Yedekleme ve geri yükleme"
- **Sorun:**
  - Yedek `savings_goal`, `category_limits` ve `budget_cycle_start_day` ayarını içermiyor. Mimari belgesi bu dışlamayı yalnız tema ve vurgu paleti için belgeliyor. Yeni cihaza geri yüklemede birikim hedefi (kullanıcının girdiği `current_amount` dahil) ve limitler kaybolur; döngü günü 1'e döner ve geri yüklenen dönemlerle yeni hesaplanan dönemler çakışır.
  - Varsayılan aralık içinde bulunulan aydır; ön ayarlar "bu ay", "geçen ay", "son 3 ay" ve "bu yıl". Tüm veriyi kapsayan bir seçenek yok. "Son yedek" kartı aralığı göstermiyor (aralık kaydediliyor ama kullanılmıyor) ve tek aylık bir dışa aktarım yedek hatırlatıcısını susturuyor.
- **Etki:** Kullanıcı varsayılan ayarla aldığı dosyayı tam yedek sanabilir.
- **Düzeltme:** "Tüm veriler" ön ayarı ekle (başlangıç: ilk kayıt tarihi) ve "son yedek" kartında aralığı göster. Hedef, limitler ve döngü gününün yedeğe girip girmeyeceğini ürün sahibine sor; girerse biçim sürümü artar (BUG-21 ile aynı sürümde birleştirilebilir).

## 5. Güvenlik bulguları

### SEC-01 — Yedek dosyası şifresiz ve yerel yolları içeriyor

- **Önem:** Orta · **Güven:** Doğrulandı · **Karar gerekli** (şifreleme kısmı)
- **Konum:** `src/services/backupService.ts:954, 1220, 1321-1400`
- **Sorun:** Dışa aktarılan JSON tüm finansal geçmişi düz metin olarak içeriyor ve paylaşım ekranı üzerinden herhangi bir uygulamaya gönderilebiliyor. Ayrıca `receipt_uri` ve `logo_uri` alanları cihazdaki yerel dosya yollarıyla birlikte yazılıyor; içe aktarım bu alanları zaten `null` yapıyor (`:856-857`), yani dosyada bulunmalarının işlevi yok.
- **Düzeltme:** Dışa aktarımda bu iki alanı `null` yaz (küçük, karar gerektirmez). İsteğe bağlı parola ile şifreleme ayrı bir özellik kararıdır; biçim sürümü ve ADR-011 güncellemesi gerektirir.
- **Kabul kriteri:** `buildBackupPayload` çıktısında hiçbir `file://` veya `content://` dizesi bulunmaz.

### SEC-02 — Üretimde korumasız loglar ve ham hata mesajı

- **Önem:** Düşük · **Güven:** Doğrulandı
- **Konum:** `src/hooks/useExpenses.ts:59, 77, 103, 151, 207, 254, 324, 365, 439`; `src/hooks/useBudget.ts:199`; `src/hooks/useDatabase.ts:21`; `src/components/ItemAnalyticsModal.tsx:159`; `src/components/BudgetHistoryCard.tsx:186`; `app/settings-data.tsx:176, 195, 219`; `app/goal-settings.tsx:162`; `app/(tabs)/transactions.tsx:268`; `app/notifications.tsx:377, 393, 426, 565, 942`; `app/_layout.tsx:387`
- **Sorun:** Bu çağrılar `__DEV__` koruması olmadan ham hata nesnesini logluyor. SQLite hata nesneleri sorgu metni ve bağlanan değerleri içerebilir; Android'de logcat'e düşer. `_layout.tsx:387` ham `error` metnini ekranda gösteriyor.
- **Düzeltme:** Tek bir `logError(tag, error)` yardımcısı yaz: `__DEV__` içinde tam nesne, üretimde yalnız etiket. Tüm çağrıları ona çevir.
- **Kabul kriteri:** `src` ve `app` altında `__DEV__` koruması olmayan ve hata nesnesi alan `console.*` çağrısı kalmaz.
- **Doğrulama notu:** Liste eksikti; `app/(tabs)/transactions.tsx` içindeki çağrı 268 değil 271. satırda. Aynı desendeki diğer çağrılar: `app/settings-budget.tsx:328, 341`; `app/(tabs)/analytics.tsx:1011, 1119, 1138`; `src/context/CurrencyContext.tsx:52, 68`; `src/context/RefreshContext.tsx:44`; `src/context/NotificationsContext.tsx:89, 233`; `src/utils/themeSchedule.ts:55`; `src/components/SavingsGoalContributionSheet.tsx:78`; `src/services/budgetCycleSettings.ts:21`. Risk düşük: `expo-sqlite` hata mesajları bağlanan değerleri değil tablo ve kolon adlarını içerir, ve güncel Android sürümlerinde başka uygulamalar logcat'i okuyamaz.

### SEC-03 — Veri sıfırlama diskte iz bırakıyor

- **Önem:** Düşük · **Güven:** Doğrulanmalı
- **Konum:** `src/services/dataReset.ts:125-138`
- **Sorun:** Sıfırlama satırları `DELETE` ile siliyor; `secure_delete` açık değil, `VACUUM` ve WAL checkpoint yapılmıyor. Silinen finansal veriler veritabanı ve WAL dosyalarında serbest sayfalarda kalabilir.
- **Düzeltme:** Transaction bittikten sonra `PRAGMA wal_checkpoint(TRUNCATE)` ve `VACUUM` çalıştır; hata olursa sıfırlamayı başarısız sayma.

### SEC-04 — `app.config.js` yorumu ile `app.json` çelişiyor

- **Önem:** Düşük · **Güven:** Doğrulandı
- **Konum:** `app.config.js:2`; `app.json` (`extra.eas.projectId`)
- **Sorun:** Yorum "projectId yalnız ortam değişkeninden okunur; kaynak kodda sabit literal yok" diyor, ancak `app.json` içinde sabit bir projectId var. EAS projectId gizli bir değer değildir; sorun belge ile kodun çelişmesidir.
- **Düzeltme:** Ya literal'i `app.json` içinden kaldır ya da yorumu gerçeğe göre düzelt.

### SEC-05 — `sanitizeText` görünmez karakterleri temizlemiyor

- **Önem:** Düşük · **Güven:** Doğrulandı
- **Konum:** `src/utils/inputValidation.ts:45-54`
- **Sorun:** Yön değiştirme (U+202A–U+202E, U+2066–U+2069) ve sıfır genişlikli karakterler (U+200B–U+200D, U+FEFF) temizlenmiyor. Yapay zekâ yanıtı veya yedek dosyası üzerinden gelen bir satıcı ya da ürün adı ekranda yanıltıcı görünebilir ve yinelenen kayıt eşlemesini atlatabilir. `substring` ile kırpma bir surrogate çiftini ortadan bölebilir. Kontrol karakterleri `trim` işleminden sonra silindiği için baştaki/sondaki boşluk kalabilir.
- **Düzeltme:** Bu aralıkları da sil, kırpmayı kod noktası sınırında yap, `trim` işlemini temizlikten sonra tekrar uygula.

### SEC-06 — `READ_EXTERNAL_STORAGE` izni

- **Önem:** Düşük · **Güven:** Doğrulanmalı
- **Konum:** `app.json` (`android.permissions`)
- **Sorun:** Uygulama galeriye `expo-image-picker`, dosyalara SAF ve `DocumentPicker` üzerinden erişiyor; bunlar hedeflenen Android sürümlerinde geniş depolama izni gerektirmeyebilir.
- **Düzeltme:** İzni kaldırıp galeri seçimi, logo yükleme ve yedek içe aktarımını desteklenen en eski Android sürümünde cihazda dene. Çalışıyorsa izni `blockedPermissions` listesine taşı.
- **Doğrulama notu:** Tarayıcı, galeriyi açmadan önce izni açıkça istiyor ve verilmezse akışı durduruyor (`app/(tabs)/scanner.tsx:273-278`). Logo seçimi aynı seçiciyi izin istemeden kullanıyor (`app/settings-data.tsx:122`). İzin kaldırılırsa tarayıcıdaki bu istek de kaldırılmalı; yoksa galeri akışı kilitlenir.

### SEC-07 — CI'da güvenlik adımı yok

- **Önem:** Düşük · **Güven:** Doğrulandı
- **Konum:** `.github/workflows/ci.yml`
- **Sorun:** İş akışı yalnız typecheck ve test çalıştırıyor. Bağımlılık zafiyet taraması ve secret taraması yok; action'lar commit SHA yerine etiketle (`@v4`) sabitlenmiş; `permissions` bloğu tanımlı değil.
- **Düzeltme:** `npm audit --omit=dev --audit-level=high` adımı ekle, `permissions: contents: read` tanımla, action'ları SHA ile sabitle.
- **Doğrulama notu:** `npm audit --omit=dev` bugün 26 kayıt döndürüyor (1 kritik, 7 yüksek, 11 orta, 7 düşük). Önerilen `--audit-level=high` adımı bu hâliyle CI'ı hemen kırar; önce SEC-08'deki ayrım yapılmalı ve yalnız üretim paketine giren bağımlılıklar için eşik konmalı. İki ek madde: `.gitignore` imzalama ve kimlik dosyalarını kapsamıyor (`*.jks`, `*.keystore`, `credentials.json`, `google-services.json`, `.env.*`); `eas.json` içinde derleme imajı `latest` olarak bırakılmış, bu da derlemeleri tekrarlanamaz yapar.

### SEC-08 — Derin bağlantı ayrıştırıcısında bilinen DoS zafiyeti

- **Önem:** Düşük · **Güven:** Doğrulandı (`npm audit` ve `npm ls`; istismar denenmedi)
- **Konum:** `package-lock.json` (`expo-router@55.0.18` → `query-string@7.1.3` → `decode-uri-component@0.2.2`); `app.json` (`scheme: "spark"`)
- **Sorun:** `npm audit` kayıtlarının çoğu derleme ve geliştirme araçlarında: `shell-quote` (kritik, `react-devtools-core` üzerinden), `node-forge` ve `zod` (`@expo/cli`), `source-map-js`, `glob`, `minimatch`. Bunlar uygulama paketine girmez. Üretim paketine giren tek zincir `query-string` ve `decode-uri-component`; hatalı yüzde kodlamalı girdide üstel ve karesel süre harcadığı bildirilmiş (GHSA-vcc3-ghjq-m6fr, GHSA-qr28-fpjm-wq7f). Uygulama `spark://` şemasını kaydettiği için cihazdaki başka bir uygulama veya bir bağlantı, hazırlanmış bir adresle uygulamanın JS iş parçacığını kilitleyebilir.
- **Etki:** Yerel hizmet reddi (uygulama donar); veri sızıntısı veya kalıcı etki yok. Derin bağlantıyla açılan ekranlar parametreye dayanarak kendiliğinden yıkıcı bir işlem yapmıyor (`add-expense`, `edit-items`, `recurring-payment` yalnız ekran açıyor).
- **Düzeltme:** `decode-uri-component` için `package.json` `overrides` ile yamalı sürümü dene (proje `form-data` ve `uuid` için zaten `overrides` kullanıyor); `query-string@7` ile modül biçimi uyumu derleme ve derin bağlantı testiyle doğrulanmalı. Olmuyorsa Expo SDK yükseltmesine bırak. Derleme araçlarındaki kayıtlar için `npm audit` çözüm olarak ana sürüm yükseltmesini gösteriyor; SDK 55 içindeki yama güncellemeleri (`expo` 55.0.32, `expo-sharing` 55.0.25) alınabilir ama bu kayıtları kapatmaz.
- **Kabul kriteri:** `npm audit --omit=dev` çıktısında `decode-uri-component` ve `query-string` kaydı kalmaz; `spark://add-expense?id=1` bağlantısı çalışmaya devam eder.

### SEC-09 — Kategori `icon` ve `color` alanları biçim doğrulamasından geçmiyor

- **Önem:** Düşük · **Güven:** Doğrulandı
- **Konum:** `src/services/backupService.ts:469-475, 1504-1505, 1527-1528`; `src/db/categoryDao.ts:38-39`
- **Sorun:** Yedekten gelen kategori `icon` ve `color` değerleri yalnız uzunluk sınırından geçiyor. `color` değeri arayüzde doğrudan stile ve `color + '22'` gibi birleştirmelere giriyor; `icon` değeri ikon adına dönüştürülüyor. Bozuk bir yedek, renk olmayan bir metni veya var olmayan bir ikon adını kalıcı hâle getirir.
- **Etki:** Görsel bozulma (soru işareti ikon, geçersiz renk uyarıları); güvenlik etkisi yok.
- **Düzeltme:** `color` için `^#[0-9A-Fa-f]{6}$` denetimi, `icon` için ikon sözlüğünde varlık denetimi ekle; uymayan değerde varsayılana (`#7C6BFF`, `tag-outline`) dön.

## 6. Performans bulguları

### PERF-01 — Ürün analizi tüm kalem tablosunu JS'e çekiyor

- **Önem:** Yüksek · **Güven:** Doğrulandı (süre ölçülmedi)
- **Konum:** `src/db/expenseDao.ts:801-893`
- **Sorun:** `getItemAnalytics` her çağrıda `financial_kind = 'product'` olan tüm satırları üç tablo birleştirmesiyle çekip JS'te süzüyor. `canonical_product_id` bilindiğinde bile SQL'de filtre yok, oysa `idx_expense_items_canonical_product` indeksi mevcut. Süzme döngüsünde `targetKey` her satır için yeniden hesaplanıyor.
- **Düzeltme:** Kimlik varsa `WHERE i.canonical_product_id = ?` ekle. Ad tabanlı yolda `targetKey` değerlerini üç ölçü birimi için döngü dışında bir kez hesapla.
- **Kabul kriteri:** Kimlikli çağrıda sorgu yalnız o ürünün satırlarını döndürür; mevcut `expenseDao` testleri geçer.

### PERF-02 — Yedek dışa aktarımı harcama başına ayrı sorgu

- **Önem:** Yüksek · **Güven:** Doğrulandı (süre ölçülmedi)
- **Konum:** `src/services/backupService.ts:908-921, 1324`
- **Sorun:** `buildBackupPayload` her harcama için ayrı bir kalem sorgusu çalıştırıyor; 3000 harcama 3000 sorgu demek. Ardından tüm yük `JSON.stringify(payload, null, 2)` ile girintili yazılıyor; bu dosya boyutunu ve bellek kullanımını artırır.
- **Düzeltme:** Kalemleri tarih aralığı için tek sorguda çek (`JOIN expenses ... WHERE e.date BETWEEN ? AND ? ORDER BY i.expense_id, i.id`) ve JS'te `expense_id` ile grupla. Girintiyi kaldır.
- **Kabul kriteri:** Dışa aktarımdaki sorgu sayısı harcama sayısından bağımsızdır; çıktı mevcut içe aktarım testleriyle aynı şekilde geri yüklenir.

### PERF-03 — Dashboard kategori limitleri

- **Önem:** Orta · **Güven:** Doğrulandı
- **Konum:** `src/hooks/useSavingsGoalData.ts:53-93`; `src/db/expenseDao.ts:462-472`
- **Sorun:** Hook önce tüm kategorileri çekiyor, sonra her limit için `getSpentForCategoryInRange` çağırıyor; bu fonksiyon da iki sorgu çalıştırıyor. Aynı veriyi tek sorguda döndüren `CategoryLimitDao.getForMonthWithSpending` zaten var ve analiz ekranı onu kullanıyor (`analytics.tsx:748`).
- **Düzeltme:** Hook'u `getForMonthWithSpending` kullanacak şekilde değiştir (BUG-12 ile birlikte çözülür).
- **Doğrulama notu:** İlk geçişteki "limit anahtarı ile harcama aralığı uyuşmuyor" notu doğrulandı ve ayrı bir hata olarak yazıldı (BUG-22). `getForMonthWithSpending` bugün yalnız Analiz'de ve takvim ayı aralığıyla çağrılıyor; hook'u ona geçirirken aralık olarak bütçe döngüsünü ver.

### PERF-04 — Fiş kaydında kalem başına kategori sorgusu

- **Önem:** Orta · **Güven:** Doğrulandı
- **Konum:** `src/services/receiptParser.ts:19-34, 89-90`
- **Sorun:** `resolveCategory` her kalem için bir ila üç sorgu çalıştırıyor. Fişteki kalemler çoğunlukla aynı birkaç kategoriye düşer; 60 kalemli fiş 60–180 sorgu demek.
- **Düzeltme:** Fonksiyonun başında kategorileri bir kez çekip ad→kimlik haritası kur; kalemleri haritadan çöz.

### PERF-05 — Analiz ekranı yenileme dalgası

- **Önem:** Orta · **Güven:** Doğrulandı (süre ölçülmedi)
- **Konum:** `app/(tabs)/analytics.tsx:1016-1050`; `src/db/expenseDao.ts:581-707, 733-799, 895-922, 982-1124`
- **Sorun:** Her odaklanma, çekme ve genel yenileme olayında 17 yükleyici sırayla çalışıyor ve her biri ayrı bir state güncellemesi tetikliyor. Bunların birkaçı (`getSilentSpendItems`, `getInflationBasketRows`, `getPriceHistory`, `getVendorItems`) dönemdeki tüm kalem satırlarını JS'e çekip orada grupluyor.
- **Düzeltme:** Veri değişmediyse (`refreshKey` ve tarih aralığı aynıysa) odaklanmada yenilemeyi atla. Ekranın alt kısmındaki kartların yükleyicilerini kart görünür olana kadar ertele. Yapmadan önce cihazda süre ölç.

### PERF-06 — Soğuk açılış maliyeti

- **Önem:** Orta · **Güven:** Doğrulandı (süre ölçülmedi)
- **Konum:** `src/db/database.ts:415-579`
- **Sorun:** Her açılışta `PRAGMA quick_check` çalışıyor; maliyeti veritabanı boyutuyla doğrusal büyür ve ilk kareyi bekletir. Ardından beş `ALTER TABLE` denemesi (her biri hata fırlatıp yutuluyor), dört `CREATE TABLE IF NOT EXISTS` bloğu ve yedi migration bayrağı sorgusu geliyor.
- **Düzeltme:** `PRAGMA user_version` ile tek bir şema sürüm numarası tut; sürüm güncelse tüm şema adımlarını atla. `quick_check` çağrısını ilk kare gösterildikten sonraya ertele veya günde bir çalıştır. ADR-002 madde 7 ve ADR-001 ile birlikte değerlendirilmeli.

### PERF-07 — Abonelik tespiti her senkronda baştan yazılıyor

- **Önem:** Düşük · **Güven:** Doğrulandı
- **Konum:** `src/notifications/buildNotifications.ts:456`; `src/services/subscriptionDetector.ts:151-197`; `src/db/subscriptionDao.ts:41-77`
- **Sorun:** Her bildirim senkronu 220 günlük harcamaları çekiyor ve tespit edilen her satıcı için bir okuma ile bir yazma yapıyor; sonuç değişmemiş olsa bile. Yazılar transaction dışında.
- **Düzeltme:** Tespit sonucu mevcut satırla aynıysa yazmayı atla; yazıları tek transaction'a al.

### PERF-08 — Fiş yanıtı iki kez ayrıştırılıyor

- **Önem:** Düşük · **Güven:** Doğrulandı
- **Konum:** `src/services/geminiService.ts:717-721`
- **Sorun:** `validateContent` içinde `tryJsonToReceipt` çalışıyor, sonuç atılıyor; ardından `cleanAndParseResponse` aynı metni baştan ayrıştırıyor.
- **Düzeltme:** `validateContent` içinde üretilen sonucu bir değişkende tut ve yeniden kullan.

### PERF-09 — İçe aktarım satır başına ayrı sorgu çalıştırıyor

- **Önem:** Orta · **Güven:** Doğrulandı (süre ölçülmedi)
- **Konum:** `src/services/backupService.ts:1941-2059` (harcama ve kalem ekleme), `:1836-1849` (yinelenen harcama başına kalem sorgusu), `:2462-2497` (hatırlatıcı başına sorgu), `:2560-2569` (bütçe başına sorgu), `:1640` (doğrusal arama); `modules/spark-bounded-file/android/.../SparkBoundedFileModule.kt:23-37`
- **Sorun:** İçe aktarım her harcama ve her kalem için ayrı bir `runAsync` çağrısı yapıyor; hazırlanmış ifade yeniden kullanılmıyor. Aynı dosya tekrar alındığında her yinelenen harcama için ayrı bir kalem sorgusu çalışıyor. Tümü tek bir yazma transaction'ı içinde olduğu için işlem boyunca yazma kilidi tutuluyor; bu da BUG-05'teki çakışma penceresini saniyelere uzatıyor.
- **Ek:** Android okuyucu dosyayı önce bayt dizisine, sonra karakter tamponuna, sonra dizgeye çeviriyor. 25 MB sınırına yakın bir dosyada tepe bellek kullanımı dosya boyutunun birkaç katına çıkar; düşük bellekli cihazda bellek hatası `INVALID_FORMAT` olarak görünür (doğrulanmalı).
- **Düzeltme:** Tekrarlanan `INSERT` ifadeleri için `prepareAsync` ile hazırlanmış ifade kullan. Yinelenen harcamaların kalemlerini tek sorguda çekip `expense_id` ile grupla. Hatırlatıcı ve bütçe denetimlerini döngüden önce yüklenen haritalarla yap. Önce 3000 harcamalı bir yedekle cihazda süre ölç.
- **Kabul kriteri:** İçe aktarımdaki `SELECT` sayısı harcama sayısından bağımsızdır.

### PERF-10 — Bütçe geçmişi kartı dönem başına 6–7 sorgu çalıştırıyor

- **Önem:** Düşük · **Güven:** Doğrulandı
- **Konum:** `src/components/BudgetHistoryCard.tsx:83-178`; `src/db/budgetRolloverDao.ts:48-57`
- **Sorun:** Kart her bütçe dönemi için harcama, borç, ödeme, ek gelir ve depozito toplamlarını ayrı ayrı sorguluyor; devir toplamı için her seferinde tüm `budget_rollovers` tablosunu yeniden okuyor. İki yıllık geçmişte 150'den fazla sorgu eder. Ekran sık açılmadığı için öncelik düşük.
- **Düzeltme:** Devir satırlarını bir kez oku. Dönem toplamlarını tarih aralığına göre gruplayan birleşik sorgularla al.

## 7. İncelenen ve sorun bulunmayan noktalar

Düzeltme ajanı bu alanları "iyileştirmeye" çalışmamalı:

- Gemini anahtarı yalnız `expo-secure-store` içinde; istekte `x-goog-api-key` başlığıyla gidiyor, URL veya loga yazılmıyor. Eski SQLite kaydı taşınıp siliniyor ve işlemler sıraya alınmış (`secureKeyStore.ts`).
- Tüm SQL sorguları parametreli. Dinamik kısımlar yalnız sabit kolon listeleri ve `?` yer tutucularıdır.
- Yapay zekâ yanıtı ve yedek dosyası için boyut, derinlik, düğüm sayısı ve prototip kirliliği sınırları var (`boundedFetch.ts`, `stripDangerousKeys`, `boundedBackupReader.ts`).
- Android otomatik yedeklemesinde SecureStore hariç tutulmuş (`plugins/android/*.xml`).
- Her yapay zekâ aktarımı öncesinde kullanıcı onayı alınıyor (`confirmAiTransfer.ts`).
- Geçici fiş görselleri ve yedek kopyaları temizleniyor (`temporaryFiles.ts`, `imageCompressor.ts`).
- Borç geri ödemesi, bütçe dönemi yazıları ve fiş kaydı transaction içinde; para hesapları minor-unit üzerinden.

İkinci geçişte eklenenler:

- Native sınırlı okuyucu (Kotlin ve Swift) bayt sınırını okuma sırasında uyguluyor ve yalnız `content://` ile `file://` adreslerini kabul ediyor.
- Android otomatik yedeklemesi yalnız `sharedpref` alanını içeriyor; SQLite veritabanı Google yedeğine girmiyor. Bunun sonucu olarak uygulama içi dışa aktarım finansal verinin **tek** yedeğidir; BUG-19 ve BUG-31 bu yüzden önemli.
- Bildirim katmanında feed mutasyonları tek kuyrukta sıralanıyor, native alarmlar işletim sisteminin gerçek envanteriyle doğrulanıyor ve kilit ekranında içerik gizli (`lockscreenVisibility: PRIVATE`).
- Tarih seçici 2000–2100 ile sınırlı ve `isSupportedYmd` ile uyumlu; arayüzden sözleşme dışı tarih girilemiyor.
- `ExpenseDao.update` tek yerden ve `syncPurchaseRecovery` ile aynı transaction içinde çağrılıyor; harcama tarihi değişince kupon kullanım kaydı tutarlı kalıyor.
- Ürün eşleştirme adayları kova boyutu sınırıyla üretiliyor (`productMatchDiscovery.ts`, `MAX_INDEX_BUCKET`); ürün sayısıyla karesel büyüme yok.
- Yedek içe aktarımındaki "çakışmada tüm işlemi geri al" davranışı kasıtlı ve testli. BUG-20 bu davranışı kaldırmayı değil, hata kodunu ve otomatik değişen alanları ele almayı önerir.

## 8. Önerilen düzeltme sırası

1. **Yedek güvenilirliği zinciri:** BUG-04 (mevcut bozuk kuponları onaran migration ile birlikte), BUG-10, BUG-19. Tek bozuk satır tüm yedekleri geri yüklenemez yaptığı ve başka yedek olmadığı için ilk sırada.
2. BUG-02, BUG-06, BUG-24, BUG-26 — küçük, bağımsız, karar gerektirmeyen düzeltmeler.
3. BUG-05 — önce `busy_timeout` ek düzeltmesi ve cihazda yeniden üretme; yazma kuyruğu ve ADR-002 güncellemesi 11. adımda.
4. BUG-22, BUG-23 — kararlar alındıktan sonra.
5. BUG-03 — ADR-004 kararından sonra; "para alanı değişmediyse dokunma" kısmı karar beklemeden yapılabilir.
6. BUG-01 — ürün kararı alındıktan sonra.
7. BUG-20, BUG-21, BUG-31 — tek bir yedek biçimi revizyonunda (v7) birlikte; üçü de karar gerektirir.
8. BUG-08, BUG-09, BUG-12, BUG-15, BUG-29, BUG-30 — doğrulama, atomiklik ve kaydetme korumaları.
9. PERF-01, PERF-02, PERF-03, PERF-04, PERF-09 — sorgu sayısı düzeltmeleri.
10. SEC-01 (yol alanları), SEC-02, SEC-05, SEC-08, SEC-09.
11. BUG-05 (yazma kuyruğu), PERF-05, PERF-06 — önce cihazda ölçüm, sonra ADR güncellemesiyle birlikte.
12. Kalan düşük öncelikli maddeler.

## 9. Cihazda doğrulanması gerekenler

Statik okumayla kapatılamayan noktalar. Düzeltme ajanı bunları doğrulanmış saymamalı.

- **Yedek gidiş-dönüşü (gerçek cihaz, Hermes):** `expenses.created_at` SQLite `datetime('now')` biçiminde saklanıyor (`2026-11-11 10:00:00`); içe aktarım bu alanı `Date.parse` ile doğruluyor (`backupService.ts:377-381, 520`). Jest V8 üzerinde çalıştığı için geçiyor. Hermes'in bu biçimi ayrıştırdığı, cihazda alınan gerçek bir yedeğin aynı cihaza geri yüklenmesiyle teyit edilmeli. Ayrıştırmıyorsa cihazda alınan her v3 ve sonrası yedek reddedilir. Sonuçtan bağımsız kalıcı çözüm: zaman damgasını düzenli ifadeyle doğrulamak veya dışa aktarımda ISO biçimine çevirmek.
- **BUG-05:** İçe aktarım sürerken uygulamayı arka plana alıp geri getir; ayrıca art arda hızlı kalem düzenlemesi yap. "Kaydedilemedi" hatası ve yarım yazılmış veri ara.
- **BUG-19:** Girintili çıktının kalem başına boyutunu ölç; 25 MB sınırına kaç kalemde ulaşıldığını kaydet.
- **BUG-25:** Listenin derinlerinde bir kaydı düzenleyip geri dönünce kaydırma konumunun davranışı.
- **BUG-27:** Uygulama önbelleği temizlendikten sonra satıcı logoları.
- **SEC-06:** İzin kaldırıldıktan sonra desteklenen en eski Android sürümünde galeri, logo ve yedek seçimi.
- **PERF-01, PERF-02, PERF-05, PERF-06, PERF-09:** Süre ölçümü; ölçmeden yeniden yazma.

## 10. Ürün sahibinden karar bekleyenler

| Bulgu | Karar |
|---|---|
| BUG-01 | Uygulama tek para birimli mi? Farklı para birimli fiş engellensin mi, toplamlar mı süzülsün? |
| BUG-03 | Yalnız ad düzeltmesi toplamı değiştirmesin mi? Son kalem silinince ve ilk kalem eklenince toplam ne olsun? (ADR-004) |
| BUG-17 | Fiş tarihi için gelecek tarih sınırı konsun mu? |
| BUG-20 | Yerelde değişmiş kayıt içeren yedekte: dur ve açıkla mı, yoksa otomatik değişen alanlarda yerel kaydı koruyup devam et mi? |
| BUG-21 | Harcama ve borçlara kalıcı kimlik eklenip yedek biçimi v7'ye çıkarılsın mı? |
| BUG-22 | Kategori limitleri yeni döngüde önceki döngüden devralınsın mı? |
| BUG-23 | Varsayılan 5000'lik bütçe tamamen kaldırılsın mı, yalnız ilk kurulumda mı kalsın? |
| BUG-28 | Kullanılmamış kupon silinebilsin mi? |
| BUG-31 | Birikim hedefi, kategori limitleri ve döngü günü yedeğe girsin mi? "Tüm veriler" ön ayarı eklensin mi? |
| SEC-01 | Yedek için parola ile şifreleme istenir mi? |

### 10.1 Ürün sahibi kararları (12 Kasım 2026)

| Bulgu | Karar |
|---|---|
| BUG-01 | A — Uygulama tek para birimli; fişin para birimi farklıysa kayıttan önce uyarı ve uygulama para birimine çevrilmiş tutar istenir. |
| BUG-20 + BUG-21 | A — Otomatik değişen alanlarda yerel kayıt korunur ve içe aktarım sürer; harcama/borç/ödeme/gelir kalıcı kimlik (uid) alır, yedek biçimi v7. |
| BUG-23 | A — Varsayılan 5000'lik bütçe tamamen kaldırılır. |
| BUG-22 | B — Limitler bütçe döngüsüne bağlanır; yeni döngüye devralınmaz. |
| BUG-31 | A — Hedef, limitler ve döngü günü yedeğe girer (v7); "Tüm veriler" ön ayarı eklenir. |
| BUG-03 | B — Başlık toplamını değiştirecek her kalem düzenlemesinde önce onay istenir. |
| BUG-28 | A — Kullanılmamış/süresi dolmuş kupon onayla silinebilir; kullanılmış kupon silinemez. |
| BUG-17 | A — Fiş tarihi için bugünden ileri üst sınır. |
| SEC-01 | A — Yedek için isteğe bağlı parola ile şifreleme. |
| BUG-13 eki | A — Kullanımdaki kategori silinirken harcamaları "Diğer"e taşıma seçeneği. |
| BUG-01 aşama 2–3 | 13 Kasım: şimdilik hiçbiri (banka ekranından okuma ve çevrimiçi kur önerisi yapılmaz; ödenen tutar elle girilir). |
| BUG-31 varsayılanı | 13 Kasım: yedekte varsayılan ön ayar "Tüm veriler" kalır (AI önerisi kabul edildi). |
| SEC-01 KDF | 13 Kasım: cihazda 23 sn ölçüldü; parola türetme kendi native modülümüze taşınır (yeni APK). |
| SEC-08 | 13 Kasım: A — paketlere dokunulmaz, erişilemezlik belgelenir, gelen bağlantılara ek koruma (uzunluk/bozuk kodlama). `shell-quote` uyumlu yamalı sürüme güncellenir (A). |

## 11. Düzeltme durumu (12 Kasım 2026)

Ürün sahibinin adım adım onayıyla uygulandı; commit atılmadı. Her satırın testi
eklendi; tam paket 206 suite / 1459 test, typecheck temiz. "Cihaz" sütunu fiziksel
cihaz doğrulamasını gösterir. Ayrıntı: [TRACEABILITY.md](TRACEABILITY.md).

| Bulgu | Durum | Not | Cihaz |
|---|---|---|---|
| BUG-04 | Kapandı | Fiş kaydında `sanitizePurchaseVoucherExpiry`; mevcut bozuk satırlar `repairVoucherExpiryOnce` ile NULL. | Hayır |
| BUG-10 | Kapandı | `ExpenseDao.create/update` tarih/para birimi/not/URI sınırları içe aktarımla aynı; not alanı `maxLength=1000`. Eski uzun notlar onarılmadı (ürün sahibi kararı). | Hayır |
| BUG-19 | Kapandı | `assertBackupJsonRestorable`; hata `section` taşır; dört dilde mesaj. Zaman damgası doğrulaması `Date.parse`'a bağlı değil. | Hayır |
| BUG-02 | Kapandı | Ortak `releaseVouchersRedeemedBy`; üç silme yolu. Eski öksüz kuponlar onarılmadı (ayırt edilemez). | Hayır |
| BUG-06 | Kapandı | Sınırsız, tek transaction, gerçek silinen sayı. | Hayır |
| BUG-24 | Kapandı | `parseMoneyInput` en çok 2 kesir basamağı; altı alan ve limit ham metni. | Hayır |
| BUG-26 | Kapandı | Kuponda Kaydet görünür, Düzenle gizli. | Hayır |
| BUG-05 | Kısmen | Yalnız `busy_timeout` (iki bağlantı). Yazma kuyruğu cihazda yeniden üretim bekliyor. | Hayır |
| BUG-08 | Kapandı | `getLocalDateMonthsAgo/DaysAgo`, `addLocalDays`; beş nokta. | Hayır |
| BUG-09 | Kapandı | Tek ifadeli upsert/katkı; `GoalDao.saveSettings` tek transaction. Limit dönem anahtarı BUG-22 ile döngüye bağlandı. | Hayır |
| BUG-12 | Kapandı | `serialQueue`; dört nokta; onRefresh `finally`. İlk mount yüklemeleri hâlâ eşzamanlı. | Hayır |
| BUG-15 | Kapandı | Ref kilitleri; başarıdan sonra ekran kapanana kadar kilit; silme hatası bildirimi. | Hayır |
| BUG-29 | Kapandı | Depozito kalemi değişince `container_deposit_paid` yeniden hesaplanır; kupon sınırı mesajı; çift dokunuş. | Hayır |
| BUG-30 | Kısmen | 4/5. İndirim satırı sezgisi (`receiptLineMerge`) değiştirilmedi: ürün sahibi gerçek "PROMO" fişleriyle test edecek; doğrulanırsa A seçeneği. | Bekliyor |
| PERF-01 | Kapandı | Kimlikte SQL filtresi; ad yolunda anahtar önbelleği. | Ölçülmedi |
| PERF-02 | Kapandı | Tek kalem sorgusu; girintisiz JSON (~%37 küçük). | Ölçülmedi |
| PERF-03 | Kapandı | Dashboard `getForMonthWithSpending`; sayım kuralı gerçek SQLite ile eşdeğer. | Ölçülmedi |
| PERF-04 | Kapandı | `createCategoryNameResolver`; fiş başına tek kategori okuması. | Ölçülmedi |
| PERF-09 | Kısmen | Yalnız yinelenen kalemlerin ön okuması. Yazma tarafı ölçüm bekliyor. | Ölçülmedi |
| SEC-01 | Kapandı (karar A) | Yol alanları export'a yazılmıyor. İsteğe bağlı parola: native PBKDF2-SHA256 600k tur (kendi modülümüz; saf JS scrypt cihazda ~23 sn sürdüğü için değiştirildi) + AES-256-GCM (`expo-crypto`), başlık AAD'ye bağlı, parola saklanmaz; yanlış parolada yeniden sorulur. Şifreli dosya 25 MB okuma sınırına sığmalı (~18 MB düz). ADR-018. | Hayır |
| SEC-02 | Kapandı | `logError` tek kapı; ADR-016 yerel hata günlüğü ve paylaşım ekranı. ErrorBoundary yalnız hata türü bildirir. Ekrandaki ham DB hatası BUG-07 ile kaldırıldı. | Ekran görüldü |
| SEC-05 | Kapandı | Görünmez/yön karakterleri; kesme UTF-16 sınırında (raporun kod noktası önerisi yedek doğrulamasıyla çeliştiği için değiştirildi). | Hayır |
| BUG-07 | Kapandı | Reddedilen açılış önbellekte kalmaz, yarım bağlantı kapanır; ham metin yerine telefon dilinde açıklama ve "Yeniden dene" (`DatabaseErrorScreen`). | Hayır |
| BUG-13 | Kapandı (+ karar A) | `CATEGORY_IN_USE` (kategori + alt kategoriler, harcama + kalem). Silerken kullanım sayılır; kullanımdaysa onayla kayıtlar sistem "Diğer"e taşınıp tek transaction'da silinir (`deleteMovingUsageToOther`). Satıcı varsayılanı FK ile temizlenir; o kategorinin limitleri CASCADE ile gider. | Hayır |
| BUG-25 | Kapandı | Yenileme yüklü satır sayısı kadar çeker; `ORDER BY ... e.id DESC`. Kaydırma konumu cihazda doğrulanmalı. | Hayır |
| BUG-23 | Kapandı (karar A) | Varsayılan bütçe tohumlanmaz; gerçek SQLite'ta tam açılış zinciriyle test edildi. Eski kurulumlarda oluşmuş 5000'lik satır ayırt edilemediği için yerinde. | Hayır |
| BUG-17 | Kapandı (karar A) | Fiş tarihi en çok bugün + 2 gün. Tarayıcıda uyarı, "Tarihi düzelt" ve dokunulabilir tarih; kayıt sınırında ikinci kontrol. Yapay zekâ yeniden denemesine bağlanmadı (kota). | Hayır |
| BUG-28 | Kapandı (karar A) | Kullanılmamış/süresi dolmuş kupon onayla silinir (`deleteVoucher`, DAO da zorlar); kullanılmış kupon silinmez. Cüzdan artık para birimine göre süzmüyor (BUG-01 6b). | Hayır |
| BUG-03 | Kapandı (karar B) | Yalnız ad düzeltmesi para alanlarına ve toplama dokunmaz; toplamı değiştiren düzenleme/ekleme/silmede önce onay; basılı toplam farkı görünür. ADR-004 12 Kasım eki. | Hayır |
| BUG-01 | Kapandı — aşama 1 (karar A) | 6a: tarayıcıda farklı para birimli fiş için ödenen tutar istenir, bütün para alanları aynı oranla uygulama para birimine çevrilir, orijinal tutar notta; okunamayan para birimi uygulama para birimi sayılır. 6b: para birimi etikettir — Ayarlar'da değişiklik onaydan sonra 10 tablonun etiketini tek transaction'da günceller (`setAppCurrency`), başarısızlık bildirilir; cüzdan süzgeci kalktı; yeni bütçe dönemi uygulama para birimini kullanır. Hatırlatıcı formunda para birimi artık salt okunur, uygulamanın para birimi (13 Kasım). Açık: aşama 2 (banka ekranıyla otomatik doldurma) ve 3 (çevrimiçi kur önerisi) ürün sahibinin ileri kararı. | Hayır |
| BUG-22 | Kapandı (karar B) | Tek kural `cycleForDate` (günü kapsayan bütçenin dondurulmuş sınırları, yoksa döngü günü) ve `resolveBudgetCycle`; limit ayarı, Dashboard (seçili döngü), Analiz ve bildirimler aynı anahtarı (döngünün başladığı ay) ve aralığı kullanır. Devralma yok. Mevcut kurulumlarda güncel takvim ayının limitleri bir kez döngü anahtarına taşınır (`migrateCategoryLimitsToCycleOnce`; hedef doluysa dokunmaz). Metinler "bu dönem". | Hayır |
| BUG-20 | Kapandı (karar A) | Aynı kayıt cihazda yedekten sonra değiştiyse cihaz kazanır ve içe aktarım sürer (ürün, alias, kalem, kupon, iade, hatırlatıcı, devir, ödeme); aynı para iki kez sayılmaz; `keptLocal` sayılıp kullanıcıya bildirilir. Kabul: süresi dolan kupon + vadesi ilerleyen hatırlatıcıyla aynı yedek geri yüklenir. Para birimi eşleştirme anahtarından çıktı, içe aktarım sonunda etiket cihazın para birimine çekilir. ADR-017. | Hayır |
| BUG-21 | Kapandı (karar A) | Harcama/borç/ödeme/gelir `uid` (açılış geçişi + tetikleyici + tekillik indeksi); yedek v7 önce `uid` ile eşleştirir, v1–v6 içerik anahtarıyla. Kategori üst adıyla taşınır; aynı üst altında aynı ad reddedilir. Kabul: tutarı değişen harcama ve tamamen ödenen borç çoğalmaz. ADR-017. | Hayır |
| BUG-31 | Kapandı (karar A) | v7 hedef, aralıktaki döngülerin limitleri ve döngü günü; cihazda varsa cihazdaki korunur. Varsayılan ön ayar "Tüm veriler"; "Son yedek" kartı aralığı gösterir. Yedek hatırlatıcısı yalnız bütün verileri kapsayan dışa aktarımla sıfırlanır (`backup_last_full_at`); kısmi yedek yalnız "Son yedek" kartını günceller (13 Kasım). | Hayır |
| BUG-11 | Kapandı | Arama doluyken liste bütün kayıtlardan gelir (`useExpenseSearch`): hafif `getSearchIndex` + dil bağımsız katlama (`foldSearchText`; "zabka" → "ŻABKA", "sok" → "ŞOK"), tam satırlar 60'lık sayfalarla. Satıcı, not, kayıtlı ve görünen (çevrilmiş) kategori adında arar; 250 ms bekleme; aramaya özgü boş durum. Kabul: 200 kayıtta en eski satıcı bulunur. | Hayır |
| BUG-14 | Kapandı (satıcı; kategori kısmen) | `vendors.name_key` (`nameIdentityKey`: büyük/küçük harf ve boşluk farkı yok, aksan korunur) + tekil indeks; açılışta mevcut kopyalar birleşir (harcama, hatırlatıcı, abonelik kararı, logo taşınır; en çok harcamalı satıcı kalır). Canlı yol ve yedek içe aktarım aynı anahtarı kullanır. Kategori oluşturmada aynı ad kontrolü de bu anahtarla. Açık: fişteki kategori adı eşleştirmesi (`CategoryDao.findByName`, `categoryNameResolver`) hâlâ ASCII; mevcut kopya kategoriler birleştirilmedi. Kabul: `findOrCreate('ŻABKA')` ve `('żabka')` aynı kimlik. | Hayır |
| BUG-27 | Kapandı | Seçilen logo `documentDirectory/vendor-logos/` altına kopyalanır, yol oraya bağlanır (`setVendorLogo`); önceki dosya silinir, kopyalama/kayıt başarısızsa eski logo kalır. Satıcı silme, birleştirme ve veri sıfırlamadan sonra sahipsiz dosyalar süpürülür; açılışta önbellekteki eski logo hâlâ duruyorsa taşınır, yoksa kayıt temizlenir, iOS kapsayıcı yolu değiştiyse kendi dosyamıza yeniden bağlanır. Yedek içe aktarımı logo yolunu artık hiç yazmaz. Yalnız uygulama önbelleğindeki kaynaklar taşınır. | Hayır |
| BUG-16 | Kapandı | `getNeedsVsWants` dil bağımsız `needs/wants/other` döndürür; etiket ve renk arayüzde (`spendSegment`), kart açıklaması anahtara göre seçilir. Yalnız `is_system = 1` kökün kanonik adı eşlenir (sistem adları değiştirilemez); alt kategoriler, kullanıcının eklediği alt kategoriler dahil, kökün grubunu alır. Gruplama değişmedi (Finans ve kullanıcı kökleri "Diğer"); eşleme tablosu `DEFAULT_CATEGORIES` ile testle bağlı. Kullanıcı köklerine grup seçtirmek ürün kararı. | Hayır |
| BUG-18 | Kapandı | İlk kurulum tohumlaması tek transaction (yarıda kalırsa hiç kategori yazılmaz, sonraki açılış baştan yapar). Kolon geçişleri `addColumnIfMissing` (`PRAGMA table_info` kontrolü; gerçek ALTER hatası açılışı durdurur ve BUG-07 ekranına düşer): `expense_items` üç kolon, `categories.is_system`, `savings_goal.current_amount`, `vendors.default_category_id/name_key`, dört tablonun `uid`'i. `CREATE_TABLES_SQL`'de zaten bulunan altı tablonun hatası yutulan tekrar blokları kaldırıldı. | Hayır |
| SEC-03 | Kapandı | Sıfırlama transaction'ından sonra `VACUUM` + `PRAGMA wal_checkpoint(TRUNCATE)`; hata sıfırlamayı başarısız saymaz, günlüğe yazılır. Kanıt: WAL modunda gerçek SQLite dosyasında 500 satır silindikten sonra metin yalnız DELETE ile db'de 500, WAL'da 188 kez okunuyordu; adımdan sonra ikisinde de 0. Flash denetleyicideki fiziksel silme uygulamanın kontrolünde değil. | Hayır |
| SEC-04 | Kapandı | Yorum gerçeğe göre düzeltildi (projectId gizli değil, `app.json`'da; `EAS_PROJECT_ID` ezer); uyarı yalnız ikisi de yoksa. Literal yerinde bırakıldı: kaldırmak yerel APK derlemesini kırabilirdi. `.env.example` güncellendi. | — |
| SEC-07 | Kısmen | `permissions: contents: read`, `persist-credentials: false`, action'lar SHA ile sabit (checkout/setup-node v4.4.0); `npm audit --omit=dev --audit-level=high` adımı yalnız rapor: kalan yüksek kayıtlar Expo SDK 55 zincirinde ve SDK yükseltmesiyle kapanır (SEC-08 erişilemezlik kaydı). `.gitignore` imzalama/kimlik dosyaları ve `.env.*`. Açık: secret taraması (GitHub depo ayarı veya ek action) ve `eas.json` derleme imajı `latest` (sabitlemek APK derlemesini etkiler; ürün sahibiyle). | — |
| SEC-08 | Kapandı (karar A; risk kabulü belgeli) | Erişilemezlik: `decode-uri-component` yalnız `query-string` `parse/parseUrl` içinde çağrılır; uygulama `query-string` kullanmaz, Expo Router 55 yalnız `stringify` çağırır (`fork/getPathFromState*.js`). Yamalı 0.5.1 yalnız ESM, CJS `query-string@7` `require()` ile kıracağı için override yapılmadı; kalıcı çözüm Expo SDK ana sürüm yükseltmesi. Ek katman: `app/+native-intent.tsx` → `filterIncomingLink` (2048 karakter, kontrol karakteri, bozuk yüzde kodlaması → `null`); uygulamanın kendi bağlantıları aynen geçer. `shell-quote` 1.10.0 → 1.12.0 (yalnız lockfile; geliştirici aracı, pakete girmez). `npm audit` bu zinciri raporlamaya devam eder; CI adımı rapor modunda kalır. Kabul (`spark://add-expense?id=1` çalışır) Jest'te; cihazda doğrulanmadı. | Hayır |
| SEC-06 | Kapandı | Ölçüldü: geçici kopyada `expo prebuild` ile üretilen manifestte `READ/WRITE_EXTERNAL_STORAGE` zaten `maxSdkVersion=32` (Android 12 ve öncesi); Android 13+'ta geniş depolama izni yok, galeri sistem seçicisiyle izinsiz. `app.json`'daki sınırsız satır kaldırıldı; manifest birebir aynı kaldı (diff boş). Android ≤12'de izin tarayıcının galeri isteği için gerçekten gerekli olduğu için engellenmedi; tamamen kaldırmak (blockedPermissions + tarayıcı isteğini kaldırma) eski Android cihaz testi gerektirir. Yapılandırma testi `privateBackup.test.ts`. | Hayır |
| PERF-08 | Kapandı | `parseReceipt` doğrulamada ürettiği sonucu metne bağlı saklar; kabul edilen metin aynıysa ikinci ayrıştırma yok (Jest: içerik için tek `JSON.parse`). Model geçişinde her deneme kendi sonucunu yazar; yedek model testi değişmeden geçer. | Ölçülmedi |
| PERF-07 | Kapandı | `SubscriptionDao.applyDetections`: mevcut satırlar tek okumada; aynı kalan tespit yazılmaz, değişen/yeni satırlar ve eskiyen aktif kayıtların silinmesi tek transaction. Değişmeyen senkron 0 yazma (gerçek SQLite). Dismissed karar korunur; `updated_at` artık son değişikliği gösterir (okuyan yok). Eski `upsert`/`deactivateMissing` kaldırıldı. | Ölçülmedi |
| PERF-10 | Kapandı | Kart önce gösterilecek dönemleri belirler (kurallar değişmedi), sonra `loadPeriodTotals` her tabloyu bütün dönemleri kapsayan aralıkta bir kez okur ve satırları sıralı ikili aramayla dönemlere dağıtır: dönem sayısından bağımsız 5 sorgu (eskiden dönem başına 5). Devir satırları zaten tek okumaydı. Borç/geri ödeme/ek gelir artık ham `SUM(REAL)` yerine kuruş tabanlı `sumMoney`. Gerçek SQLite'ta tekil DAO fonksiyonlarıyla kuruşu kuruşuna eşdeğerlik (sınır günleri, kupon kırpması, `lent` hariç, para birimi, kupon iadesi hariç). | Ölçülmedi |
| SEC-09 | Kapandı | `safeCategoryIcon/Color`; içe aktarım ve kategori oluşturma; reddetmek yerine varsayılan. | Hayır |

Açık kalanlar (bulgu düzeyi): SEC-07 (kısmen); PERF-05, 06 (cihaz ölçümü bekliyor).
