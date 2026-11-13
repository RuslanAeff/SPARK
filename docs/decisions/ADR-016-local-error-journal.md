# ADR-016 — Yerel, kullanıcı onayıyla paylaşılan hata günlüğü

Durum: Accepted · prospective; fiziksel cihazda ekran ve paylaşım görüldü, uzun süreli kullanım kabulü açık.
Tarih: 12 Kasım 2026. İnsan kararı: ürün sahibi bulut servisi kurmadan, kullanıcının kendi onayıyla hata çıktısını geliştiriciye gönderebileceği bir sistem istedi ve önerilen tasarımı onayladı.

## Bağlam

Kod denetimi (SEC-02) yayın sürümünde ham hata nesnelerinin Android sistem
günlüğüne yazıldığını buldu. Bu ayrıntıyı kaldırmak, kullanıcıların yaşadığı
hataları öğrenmenin tek yolunu da kapatıyordu. Dış hata raporlama servisi
(ör. Sentry) DESIGN_BRIEF'in "hesap veya bulut bağlantısı gerektirmez" ve
"merkezi backend bulunmaz" ilkeleriyle çelişir; izin akışı, mağaza veri
güvenliği beyanı ve ek gizlilik filtresi gerektirir.

## Karar ve değişmezler

- Uygulamadaki bütün hata kayıtları tek kapıdan geçer: `src/utils/logError.ts`.
  Geliştirmede tam hata nesnesi konsola yazılır; yayın sürümünde yalnız etiket.
  Yeni kodda `console.error/warn` ile ham hata loglanmaz.
- `logError`, açılışta takılan bir hedefe (sink) de bildirir. Hedef
  `src/services/errorJournal.ts`'dir; testlerde hedef takılı değildir.
- Günlük **yalnız cihazdadır**: uygulama belge klasöründe `error-journal.json`.
  Hiçbir ağ çağrısı yapılmaz. Kullanıcı "Raporu paylaş" demedikçe cihazdan çıkmaz;
  paylaşım işletim sisteminin paylaşma ekranıyla, düz metin olarak yapılır.
- SQLite'a yazılmaz: hatalar her an gelir ve aynı bağlantıda eşzamanlı yazı
  ADR-002'yi ihlal ederdi. Dosya finansal yedeğe ve Android otomatik yedeğine
  (yalnız `sharedpref`) girmez; "tüm verileri sil" günlüğü de temizler.
- Kayıt yalnız zaman, etiket, hata türü ve süzülmüş kısa açıklama içerir.
  Süzgeç URI/dosya yolu, e-posta, tırnak içindeki metin (ad), ondalıklı sayı
  (tutar), üç haneden uzun sayı ve API anahtarı biçimini siler; en fazla 200 kayıt.
- Çökme ekranı (ErrorBoundary) ham hata verisini geliştirmede bile yazmaz;
  günlüğe yalnız hata **türünü** bildirir (`reportErrorKind`).
- Yakalanmamış JS hataları genel işleyiciyle günlüğe düşer ve önceki işleyiciye
  devredilir. Eşzamanlı dosya API'si sayesinde ölümcül hatada da kayıt yazılır.
- Kullanıcı gönderilecek her kaydı paylaşmadan önce ekranda görür
  (Ayarlar → Veri ve yedek → Hata günlüğü).

## Sonuçlar ve sınırlamalar

Hata ancak kullanıcı raporu gönderirse geliştiriciye ulaşır. Native (Kotlin/Swift)
çökmeler ve işlenmemiş promise retleri bu günlüğe düşmez. Süzgeç sezgiseldir;
yeni bir hata mesajı kalıbı süzgeçten kaçabilir — bu yüzden kullanıcı içeriği
paylaşmadan önce görür. Dış servis ileride istenirse aynı sink'e ikinci bir
hedef eklenir; bu, yeni bir ADR, izin akışı ve gizlilik beyanı gerektirir.

## Doğrulama

`logError`, `errorJournal` (süzgeç, kalıcılık, sınır, tür-only mod, bozuk dosya,
kurulum), `ErrorJournalScreen`, `SettingsDataProductMatching` ve değişmeyen
`ErrorBoundary.security` testleri. Fiziksel Android cihazda ekranın açıldığı ve
boş durumun göründüğü kullanıcı ekran görüntüsüyle doğrulandı (12 Kasım 2026).
Gerçek hata kaydının düşmesi, yeniden açılışta korunması ve paylaşılan metnin
içeriği cihazda henüz doğrulanmadı.
