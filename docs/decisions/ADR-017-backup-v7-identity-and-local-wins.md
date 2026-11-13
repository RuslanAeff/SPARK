# ADR-017 — Yedek v7: kalıcı kimlik, "cihaz kazanır" ve tam kapsam

Durum: Accepted · prospective; fiziksel cihazda dışa/içe aktarım henüz doğrulanmadı.
Tarih: 13 Kasım 2026. İnsan kararı: ürün sahibi kod denetimindeki BUG-20 + BUG-21
için A'yı (otomatik değişen alanlarda yerel kayıt korunur ve içe aktarım sürer;
harcama/borç/ödeme/gelir kalıcı kimlik alır, biçim v7) ve BUG-31 için A'yı (hedef,
limitler ve döngü günü yedeğe girer; "Tüm veriler" ön ayarı) seçti.

## Bağlam

v6'ya kadar içe aktarım, aynı kimlikli bir kaydın cihazdaki hâli yedektekinden
farklıysa bütün işlemi `INVALID_FORMAT` ile geri alıyordu. Farkı üreten olaylar
sıradandı ve bir kısmı otomatikti (kuponun süresinin dolması, hatırlatıcının
vadesinin ilerlemesi), bu yüzden geçerli yedekler aynı cihaza geri yüklenemiyordu.
Harcama, borç, ödeme ve ek gelirin taşınabilir kimliği yoktu; içerik anahtarı
değişen kayıt (tutarı düzeltilen harcama, tamamen ödenen borç) ikinci kez
ekleniyordu. Hedef, limitler ve döngü günü yedeğe hiç girmiyordu.

## Karar ve değişmezler

- **Kalıcı kimlik.** `expenses`, `debts`, `debt_payments`, `extra_incomes` bir
  `uid` (UUID v4) taşır. Eski kurulumda kolon açılışta eklenir ve mevcut satırlara
  bir kez kimlik verilir; tekillik indeksi vardır. Kimliksiz eklenen her satıra
  veritabanı tetikleyicisi kimlik verir (`src/db/recordUid.ts`), böylece yeni
  yazma yolları kimliği unutamaz.
- **Biçim v7.** Bu dört koleksiyonda `uid` zorunlu ve dosya içinde tekildir.
  İçe aktarım önce `uid` ile, bulamazsa eski içerik anahtarıyla eşleştirir;
  v1–v6 dosyaları yalnız içerik anahtarıyla eşleşmeye devam eder. Kategori, üst
  kategori adıyla birlikte taşınır; aynı adlı alt kategoriler ayrılır. Aynı üst
  altında aynı adlı ikinci kategori açılamaz (`CATEGORY_NAME_EXISTS`).
- **Cihaz kazanır.** Aynı kayıt cihazda yedekten sonra değişmişse cihazdaki hâli
  korunur, yedekteki atlanır ve içe aktarım sürer. Bu kural ürün, alias, kalem,
  kupon, depozito iadesi, hatırlatıcı, devir, harcama, borç, ödeme, gelir, hedef,
  limit ve döngü günü için aynıdır. Hiçbir yerel kayıt ezilmez; aynı para iki
  kez sayılmaz (zaten kullanılmış kupona ikinci iade, anaparayı aşan ödeme veya
  aynı kaynak dönem için ikinci devir eklenmez). Korunan kayıtlar `keptLocal`
  ile sayılır ve kullanıcıya bildirilir.
- **Para birimi etikettir** (BUG-01 6b). Eşleştirme anahtarlarına girmez; içe
  aktarım sonunda bütün kayıtlar cihazın para birimi etiketini alır.
- **Biçimsel olarak bozuk dosya** (eksik/yinelenen kimlik, bilinmeyen referans,
  sınır dışı değer) yine yazmadan önce bütünüyle reddedilir.
- **Kapsam.** Yedek birikim hedefini, aralıkla kesişen döngülerin kategori
  limitlerini ve döngü gününü taşır. Varsayılan ön ayar "Tüm veriler"dir (en eski
  kayıttan bugüne veya ileri tarihli son kayda); "Son yedek" kartı kapsanan aralığı gösterir.

## Sonuçlar ve sınırlamalar

Kullanıcı eski bir yedeği yüklediğinde cihazda sonradan yaptığı değişiklikler
geri alınmaz; yedekteki eski hâli istiyorsa önce cihazdaki kaydı silmelidir.
Tetikleyicinin ürettiği kimlik SQLite `randomblob` kullanır. Kategori adı
karşılaştırması SQLite `lower()` ile yapılır ve yalnız ASCII harflerde büyük/küçük
farkını yok sayar. Yedek hatırlatıcısı yalnız bütün verileri kapsayan dışa aktarımla
sıfırlanır; güncelleme öncesi son yedek bir kez tam sayılır.

## Doğrulama

Gerçek SQLite ve uygulamanın tam açılış zinciriyle: `backupLocalWins`,
`backupRecordIdentity`, `backupSettingsScope`, `recordUid`, `categoryDaoCreate`;
çakışmada reddi bekleyen eski testler bu karara göre güncellendi
(`backupService`, `backupExportQueries`, `budgetRolloverBackup`,
`containerDepositBackup.security`). Arayüz: `BackupSection` testleri.
