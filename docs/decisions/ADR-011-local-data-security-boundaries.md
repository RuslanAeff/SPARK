# ADR-011 — Dış dosya, gizli anahtar ve aktarım sınırları

Durum: Implemented · prospective; native doğrulama ve ürün kabulü bekleniyor.
Tarih: 16 Eylül 2026. İnsan talebi: güvenlik raporunu doğrula ve sırayla düzelt.

## Bağlam

Boyut kontrolünden önce kopyalama/okuma, taşınmayan görsel adreslerine güvenme ve
legacy anahtar migration'ıyla yarışan silme, mevcut yerel veri sözleşmesini
zayıflatıyordu. Tarama ve ürün karşılaştırması alıcı/veri açıklamasını işlem
anında yeterince göstermiyordu.

## Karar ve değişmezler

- Backup okuması uygulamaya ait yerel Expo modülünde bayt sınırıyla yapılır.
  Android content sağlayıcısında InputStream, Apple'da güvenlik kapsamlı URL ve
  FileHandle kullanılır. Sınır/hata durumunda kaynak kapanır; cache kopyası yoktur.
  Native modül yoksa işlemi durdur; sınırsız read/text fallback'i ekleme.
- Şema/transaction modeli korunur. Restore görsel URI'lerini taşımaz. JSON
  sanitizer iteratif çalışır ve tehlikeli prototype anahtarlarını temizler.
- Gizli anahtar migration/okuma/yazma/silme işlemleri sırayla çalışır; legacy
  temizliği ve native silme tamamlanmadan başarı bildirilmez.
- Android XML yedek kuralları yalnız önceki sharedpref include kapsamını korur,
  SecureStore ve bildirim deposunu dışlar. Overlay engellenir; production AAB olur.
- Her AI isteği açık aktarım açıklaması sonrası olumlu eylem gerektirir. Pazar ve
  Gemini hizmet türü bu kararın kapsamı dışındadır; insan kararı ve metin
  sonuçları [ADR-012](ADR-012-ai-transfer-service-and-market-scope.md)'de.
- Tarama kopyası taramanın ömrüyle sınırlıdır. Başlatılan paylaşımın cache kopyası
  24 saatten sonraki ilk açılış/export temizliğine kadar korunur; bu seçim alıcının
  geç okumasını destekleyen teknik varsayımdır, cihazda ve insan kabulünde sınanmalıdır.

## Sonuçlar ve sınırlamalar

Yeni native build zorunludur; Expo Go import yapamaz. Eski picker cache'ini
logolarla ayırt etmeden toplu silmek güvenli değildir. Paylaşımın ve cache
silme hatalarının tüm platform davranışları otomatik testlerle kanıtlanamaz.
Hizmet koşulları kabulü, risk kabulü veya mağaza yayını bu kararla verilmez.

## Doğrulama

`backupService`, `boundedBackupReader`, `backupExportCleanup`, `secureKeyStore`,
`SettingsAiScreen`, `ScannerScreen`, `ProductMatchingScreen`, `temporaryFiles`,
`inputValidation`, `imageCompressor`, `privateBackup` regresyonları ve yerel
Foundation okuyucu probe'u. Ayrı kalan işler: Android/iOS module derlemesi,
gerçek sağlayıcı, release manifest/XML, backup/restore/reboot, ağ ve paylaşım
kaydı. Sonuçlar [düzeltme kaydında](../evidence/SECURITY_REMEDIATION_2026-09-16.md).
