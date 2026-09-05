# ADR-008 — Bütçe dönemleri tarihsel olarak değişmezdir

**Durum:** Accepted · prospective  
**Tarih:** 2026-08-21

## Karar

Her bütçe kaydı kendi `period_start`, `period_end` ve `cycle_start_day`
değerlerini saklar. Global başlangıç günü yalnız yeni dönemlerin kuralıdır;
tamamlanmış dönemleri yeniden yorumlayamaz.

Başlangıç günü değiştirilip bütçe kaydedildiğinde yeni düzen bugün yürürlüğe
girer. Bugünü kapsayan eski dönem dün kapanır ve yeni dönem bugün başlar.
Böylece gerçek işlem tarihi değiştirilmez, dönemler çakışmaz ve aynı harcama iki
bütçede sayılmaz.

Eski kurulumlar migration sırasında o anda kayıtlı başlangıç günüyle bir kez
snapshot edilir. Backup dönem sınırlarını taşıyarak restore sonrasında aynı
tarihsel görünümü korur.

## 3 Eylül 2026 — değişmezin zorlanması ve onarım yolu

Önceki sürümde "dönemler çakışmaz" kuralı yalnız bu belgede yazıyordu; kodda
hiçbir kontrol yoktu. `setMonthlyBudget` temizliği yalnız `period_start` birebir
eşleşen satırı kapatıyordu, farklı başlayıp üst üste binen satır aktif kalıyordu.
Sonuç: aynı takvim gününü iki aktif dönem kapsıyor, aynı harcama iki bütçede
sayılıyor ve geçmiş şeridinde iki "mevcut" rozeti çıkıyordu.

- **Değişmez artık yazma yolunda zorlanır.** `setBudgetForPeriod` tek giriş
  noktasıdır; hedef dönemle kesişen bütün aktif satırları aynı transaction
  içinde pasife çeker, sonra yazar. `transitionAndSetBudget` de kısaltmadan
  sonra aynı kesişim temizliğini uygular.
- **`start_date` her zaman dönemin başladığı aydır**, seçilen navigatör ayı
  değil. İki farklı "ay" kavramının karışması bu şekilde ortadan kalkar.
- **Yetkili satır seçimi tek kuraldır:** çakışma varsa en yüksek `id` kazanır
  ("son yazılan kazanır"). `getContainingDate` ve `findShadowedBudgetIds` aynı
  sırayı kullanır; böylece Dashboard, Analiz, bildirimler ve geçmiş şeridi aynı
  satırı yetkili sayar.
- **Eski veri otomatik silinmez.** Gölgelenen kayıt hesaplamadan çıkarılır ve
  kullanıcıya "çakışıyor" olarak gösterilir; düzeltmeyi kullanıcı yapar. Ayrı
  bir onarım ekranı üretilmez — onarım, normal düzenleme akışının kullanımıdır.
- **Başlamamış döneme bütçe yazılamaz.** Navigatör mevcut dönemde durur.
- **Düzenleme penceresi mevcut dönem + önceki 4'tür.** Tek istisna: değişmezi
  ihlal eden gölgelenmiş kayıt, pencere dışında kalsa bile seçilip silinebilir;
  aksi halde erişilemeyen bir satır analizde çift saymaya devam ederdi.
- **Bütçe silmek hedefi kaldırır, harcamayı değil.** `deleteBudget` yalnız
  `budgets` satırını siler; dönem "bütçesiz" görünür, tarihsel toplamlar korunur.

## Doğrulama sınırı

Saf/DAO/component testleri otomatik çalıştırılır. Gerçek Expo SQLite migration'ı
ve 23→21 geçişi standalone build üzerinde ayrıca doğrulanmalıdır.
