# ADR-018 — İsteğe bağlı parolalı yedek şifrelemesi

Durum: Accepted · prospective; fiziksel cihazda şifreli dışa/içe aktarım ve süre henüz ölçülmedi.
Tarih: 13 Kasım 2026. İnsan kararı: ürün sahibi kod denetimindeki SEC-01 için A'yı
(isteğe bağlı parola ile şifreleme) ve önce "expo-crypto + noble" yolunu seçti
(yerel AES, saf JS scrypt). Fiziksel cihazda parola türetme ~23 sn sürdü; ürün
sahibi aynı gün türetmenin uygulamanın kendi native modülüne taşınmasını seçti
(yeni APK gerekir, yeni kütüphane yok). `@noble/hashes` kaldırıldı.

## Bağlam

Yedek JSON'u bütün finansal geçmişi düz metin taşır ve paylaşım ekranıyla her
uygulamaya gönderilebilir. Yerel dosya yolları SEC-01'in ilk bölümünde zaten
kaldırıldı ([ADR-011](ADR-011-local-data-security-boundaries.md)). Uygulama hesap
veya bulut kullanmaz; anahtar yalnız kullanıcının parolasından türetilebilir.

## Karar ve değişmezler

- **İsteğe bağlı.** Dışa aktarımda "Şifreyle koru" açılırsa parola (en az 8
  karakter, iki kez) istenir; kapalıysa dosya eskisi gibi düz v7 JSON'dur.
- **Algoritmalar.** Parola → 256 bit anahtar: PBKDF2-HMAC-SHA256, 600.000 tur
  (OWASP 2023), `modules/spark-bounded-file` içinde native: Android'de platform
  `HmacSHA256` üzerine RFC 8018 döngüsü, iOS'ta CommonCrypto `CCKeyDerivationPBKDF`.
  Parola tam UTF-8 baytlarıyla kullanılır; iki platform bayt bayt aynı anahtarı
  üretir. JS'e yavaş geri düşüş yoktur: native fonksiyon yoksa (eski APK)
  `BACKUP_ENCRYPTION_UNAVAILABLE` ve "uygulamayı güncelle" mesajı. Şifreleme:
  AES-256-GCM, platformun yerel uygulaması (`expo-crypto`). Her dosyada rastgele
  16 bayt tuz ve 12 bayt IV.
- **Zarf.** `{ app, format: "spark-encrypted-backup", envelope_version: 1, kdf,
  cipher, data }`. Başlık GCM'nin ek doğrulanmış verisidir; başlıkla veya veriyle
  oynanırsa çözme başarısız olur. Zarfın içi, düz yedekle aynı v7 doğrulamasından geçer.
- **Parola saklanmaz.** Ne veritabanına ne güvenli depoya yazılır; yalnız tek
  dışa/içe aktarım çağrısına verilir. Unutulursa yedek açılamaz (kurtarma yok);
  arayüz bunu parola sorulurken söyler.
- **Kötü niyetli dosya.** İçe aktarım tur sayısını (100.000–2.000.000) ve tuzu
  (16–64 bayt) parola türetmeden önce sınırlar; native taraf aynı sınırı ayrıca
  uygular. Bilinmeyen KDF (geliştirme sırasında üretilmiş scrypt dosyaları dahil)
  `UNSUPPORTED_VERSION` olur.
- **Yanlış parola.** `BACKUP_WRONG_PASSWORD`; arayüz parolayı yeniden sorar,
  vazgeçilirse hiçbir şey yazılmaz. GCM yanlış parola ile bozuk dosyayı ayırt etmez.
- **Boyut.** Okuma sınırı 25 MB'dır ve native modülde sabittir; base64 zarf
  ~%33 büyüdüğü için şifreli yedek düz hâlde yaklaşık 18 MB'ı aşarsa dışa aktarım
  `BACKUP_EXPORT_TOO_LARGE` verir (daha kısa aralık önerilir).

## Sonuçlar ve sınırlamalar

PBKDF2 scrypt'ten farklı olarak bellek-yoğun değildir; GPU ile tahmin denemesine
karşı daha zayıftır, bu yüzden tur sayısı yüksek tutuldu ve en az 8 karakterlik
parola istenir. Tur sayısı zarfa yazıldığı için biçim değişmeden artırılabilir.
Native değişiklik yeni APK gerektirir. Süre cihazda yeniden ölçülmeli (macOS'ta
Swift uygulaması 600.000 turda ~0,7 sn). Parola Unicode normalize edilmez; farklı klavyelerde aynı görünen
farklı karakterler farklı parola sayılır. Jest'te AES, Node AES-GCM tabanlı bir
sahteyle sınanır (`src/test-utils/expoCryptoAesMock.ts`); yerel AES'in gerçek
davranışı yalnız cihazda doğrulanabilir.

## Doğrulama

Swift uygulaması yerelde derlenip Node `pbkdf2Sync` ile Türkçe/emoji parolada
bayt bayt karşılaştırıldı; Kotlin döngüsü yerelde JDK olmadığı için derlenemedi,
aynı döngünün birebir JS çevirisi Node ile doğrulandı (Android derlemesi ve cihaz
testi açık). `backupEncryption` (gidiş-dönüş, rastgele tuz/IV, yanlış parola,
başlık/veri değişikliği, kısa parola, aşırı parametre, desteklenmeyen KDF, eski
APK'da açık hata, UTF-8), `backupEncryptedFlow` (dosyada
düz metin yok, yanlış parolada yeniden sorma, vazgeçince yazma yok) ve
`BackupSection` (parola tekrarı, kısa parola, içe aktarımda yanlış parola mesajı).
