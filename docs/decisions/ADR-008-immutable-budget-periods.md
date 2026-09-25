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

## 25 Eylül 2026 — tutar, takvim ve tarih onarımının ayrılması

Kullanıcı incelemesi, önceki akışın değişmezleri korusa da anlaşılır ve
onarılabilir olmadığını gösterdi. Beş dönemden eski kayıtlar seçilemiyor, aynı
ayda başlayan birden fazla satır yalnız ay anahtarıyla açılıyor ve başlangıç
günü bütçe tutarıyla aynı kaydetme eyleminde bugünkü dönemi kesiyordu. Ayrıca
exact satırı olmayan dönemde son bütçe Dashboard'da sessizce devam ederken
Ayarlar boş görünüyordu.

Bu ek karar, yukarıdaki 3 Eylül bölümünün “bugün kesen geçiş”, “beş dönemlik
pencere” ve “ay anahtarıyla normal düzenleme” maddelerini değiştirir:

- Bütçe tutarı exact `budget.id` ile düzenlenir; yalnız tutar değişir. Kayıtlı
  bütün geçmiş dönemler seçilebilir. Ay anahtarı yalnız boş dönem gezinmesidir.
- Önceki plan, exact kayıt yoksa yalnız ileri yönde varsayılan olur ve UI bunu
  açıkça gösterir. Gelecek plan geçmişe fallback olamaz.
- Başlangıç günü ayrı kaydedilir. Devam eden dönem korunur; gerekiyorsa ertesi
  gün ile yeni doğal çıpa arasına exact geçiş dönemi yazılır. Devralınmış mevcut
  plan, global kural değişmeden önce exact snapshot'a dönüştürülür.
- Yanlış tarih düzeltmesi ayrı onarımdır. Çakışma reddedilir; devir bağlantısı
  bulunan dönem önce devrin geri alınmasını gerektirir.
- Sağlık kontrolü salt okunurdur ve kendiliğinden veri değiştirmez.

Yeni tablo veya alan eklenmedi. Geçiş dönemleri mevcut `budgets` satırlarıdır;
bu nedenle backup v5'in bütçe taşıma sözleşmesi değişmez. Saf tarih testleri,
gerçek bellek-içi SQLite DAO testleri ve ekran testleri otomatik kanıttır;
standalone Android'deki tarih girişi, uzun geçmiş şeridi, klavye ve görsel
anlaşılabilirlik ayrıca doğrulanmalıdır.
