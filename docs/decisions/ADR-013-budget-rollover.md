# ADR-013 — Bütçe devri ayrı bir finansal olaydır

**Durum:** Accepted · prospective
**Tarih:** 2026-09-22
**İlgili kararlar:** [ADR-003](ADR-003-financial-cash-flow-domain.md) (nakit akışı
alan sınırları), [ADR-008](ADR-008-immutable-budget-periods.md) (dönemlerin
tarihsel değişmezliği).

## Bağlam

Bir dönem kapandığında planlanan bütçeden artan tutar sonraki dönemde
kullanılabilir olmasına rağmen uygulamada hiçbir yerde görünmüyordu. Kullanıcı
artan parayı yeni dönemin bütçesine elle ekleyince iki bilgi birden kayboluyordu:
eski dönemde gerçekte ne kadar harcandığı ve yeni dönemdeki tutarın nereden
geldiği. Aynı parayı "ek gelir" olarak kaydetmek ise gelir ve harcama analizlerini
şişiriyordu; devredilen tutar yeni kazanılmış para değil, zaten var olan paranın
başka bir dönemde kullanılmasıdır.

## Karar

Devir, harcama ve ek gelirden ayrı, kendi tablosu olan bir finansal olaydır:
`budget_rollovers`. Kaydın kimliği kaynak ve hedef dönem sınırlarıdır; para birimi
ve tutar minor birimde saklanır.

1. **Her iki dönemde de görünür.** Kaynak dönem kendi sonucunu korur: plan,
   harcama ve dönem kalanı değişmez; devredilen tutar ile devredilmeden kalan
   ayrıca gösterilir. Hedef dönemde devreden tutar `carryIn` olarak
   `computeDebtAdjustedBudget` hesabına girer ve harcanabilir bütçeyi artırır.
   Böylece geçmişe bakıldığında "bu dönemde 1.000 harcamışım" yanılgısı oluşmaz.
2. **Ek gelir değildir.** `extra_incomes` tablosuna satır yazılmaz; gelir
   toplamları, kişisel enflasyon ve kategori analizleri etkilenmez.
3. **Aktarımı kullanıcı onaylar.** Otomatik devir yoktur. Kullanıcı kaynak dönemin
   kalanının tamamını veya bir kısmını aktarabilir; aktarılmayan kısım kaynak
   dönemde "devredilmeden kalan" olarak görünür.
4. **Kaydetmek toplamı değiştirir, üzerine eklemez.** Kaynak dönem başına en çok
   bir devir kaydı vardır (`UNIQUE(source_start, source_end)`), tutar sıfır
   girilirse kayıt silinir. Tekrarlanan gönderim aynı parayı ikinci kez aktarmaz.
5. **Aktarım koşulları dardır.** Kaynak ve hedef dönem bitişik olmalı
   (`source_end` + 1 gün = `target_start`), aynı para biriminde ve her biri tek
   aktif bütçe satırıyla temsil edilmelidir. Hedef dönem bugünü kapsamalı, kaynak
   dönem kapanmış olmalıdır. Devredilen tutar kaynak dönemin kalanını aşamaz.
6. **Geçmiş sonradan değişirse hesap sessizce düzeltilmez.** Kaynak döneme
   unutulmuş bir harcama eklenir veya bütçesi düşürülürse devir tutarı olduğu gibi
   kalır ve her iki dönemde "gözden geçir" uyarısı çıkar. Düzeltmeyi kullanıcı
   yapar: tutarı düşürür veya devri geri alır. Desteklenmeyen bir devir zinciri
   ileri taşınamaz; yukarı akıştaki açık aşağı akışta da görünür.
7. **Devre bağlı dönem kilitlidir.** Devir kaydı bulunan bir bütçe dönemi
   silinemez; tarihleri veya para birimi değiştirilemez. Yalnız tutar düzenlemesi
   serbesttir ve bağlantıyı korur. Kilit DAO yazma yolunda zorlanır, yalnız
   belgede değil.
8. **Yedek biçimi v5'tir.** Devir kayıtları yedeğe girer ve export aralığı,
   bağlantılı dönemlerin tamamını kapsayacak şekilde genişletilir; aksi halde
   restore, kaynak bakiyesi bilinmeyen bir devir üretirdi. Çakışan veya eksik
   bağlamlı payload kısmi yazı bırakmadan reddedilir; v1–v4 yedekler devir
   koleksiyonunu boş kabul eder. Veri sıfırlamada `budget_rollovers`,
   `budgets`'tan önce silinir.

## Değişmezler

- Devir kaydı ne `expenses` ne `extra_incomes` satırı üretir; harcama toplamları
  ve gelir analizleri devirden etkilenmez.
- Bir dönem çifti arasında en çok bir devir kaydı bulunur ve toplam tutar
  kaynağın kalanını aşamaz.
- Kaynak dönemin plan/harcama/kalan üçlüsü devirden sonra da okunabilir kalır.
- Devir yalnız kapanmış bir dönemden, bugünü kapsayan bitişik ve aynı para
  birimli döneme yapılır.
- Kaynak tarafındaki sonraki değişiklikler hedef dönemin tutarını otomatik
  değiştirmez; yalnız gözden geçirme uyarısı üretir.

## Sonuçlar

- `useBudget`, bildirimler ve Android hatırlatıcı planlayıcısı aynı etkin bütçeyi
  kullanır; eşik bildirimleri (%80/%100) devirli dönemde de doğru paydayı görür.
- Bütçe geçmişi şeridi dönem doluluğunu plan yerine etkin bütçeye göre çizer.
- Bütçe yazma yolları artık kilit ihlalinde `rollover_period_locked` hatası
  döndürür; ekranlar bunu genel "kaydedilemedi" mesajı yerine ne yapılması
  gerektiğini söyleyen metne çevirir.
- Yeni dönem bütçesine devredilecek tutar zaten elle eklendiyse aktarım toplamı
  iki kez sayabilir. Bu, hesapla ayırt edilemez; aktarım ekranı bunu açıkça
  yazar ve karar kullanıcıya bırakılır.
- "Bütçeden kaldı" ifadesi banka bakiyesi garantisi değildir; hesap yalnız
  kullanıcının girdiği bütçe ve işlemlere dayanır.

## Doğrulama sınırı

DAO davranışı gerçek bellek-içi SQLite üzerinde, yedek uçtan uca aynı motorla,
ekran bölümü ise mock'lu component testleriyle doğrulanır. Bunlar gerçek Expo
SQLite migration'ını, cihazdaki klavye/erişilebilirlik davranışını veya
kullanıcının aktarım metinlerini doğru anladığını kanıtlamaz; bu kabuller ayrıca
kaydedilmelidir.
