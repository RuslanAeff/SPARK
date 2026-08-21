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

## Doğrulama sınırı

Saf/DAO/component testleri otomatik çalıştırılır. Gerçek Expo SQLite migration'ı
ve 23→21 geçişi standalone build üzerinde ayrıca doğrulanmalıdır.
