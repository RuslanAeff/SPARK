# ADR-012 — AI aktarımında hizmet katmanı ve pazar kapsamı

Durum: Accepted · prospective; canlı gizlilik metni ve Play beyanı doğrulanmadı.
Tarih: 16 Eylül 2026. İnsan kararı: ücretsiz Gemini katmanı serbest, pazar global.

## Bağlam

SEC-04 kod tarafında çözülmüştü: her tarama ve ürün önerisi aktarım açıklaması ve
olumlu eylem ister. Ancak açıklama metni "hesap, bölge ve hizmet koşullarına
bağlıdır" diyerek asıl soruyu kullanıcıya bırakıyordu; hangi Gemini katmanının
destekleneceği ve hangi pazara çıkılacağı bilinmeden ne gizlilik metni ne de Play
Data safety beyanı kesinleştirilebiliyordu. Fiş verisi kişisel finansal veridir.

## Karar ve değişmezler

- Kullanıcı kendi anahtarını girer ve **ücretsiz katman da desteklenir**. Uygulama
  anahtarın katmanını tespit etmeye veya ücretsiz anahtarı engellemeye çalışmaz.
- Ücretsiz katmanın bedeli açıkça yazılır: Google gönderilen içeriği, insan
  incelemesi dahil, hizmetlerini geliştirmek için kullanabilir. Bu cümle aktarım
  onayında, anahtar yardım metninde ve gizlilik metninde aynı anlamda bulunur;
  "hizmet koşullarına bağlıdır" gibi kararı kullanıcıya devreden ifade kullanılmaz.
- Hassas fişler için ücretli anahtar önerilir; öneri engelleme değildir.
- Pazar kapsamı **global**, bölge kısıtı yoktur. Bu nedenle metin, aktarımın yurt
  dışındaki (ABD dahil olabilen) sunuculara gittiğini ve her aktarım için verilen
  onayın işlemenin dayanağı olduğunu söyler. Onay yoksa AI amacıyla veri çıkmaz.
- Dört dilde (TR/EN/AZ/RU) aynı bilgi verilir; hiçbir dilde uyarı yumuşatılmaz.

## Sonuçlar ve sınırlamalar

Global kapsam GDPR dahil en geniş uyum yükünü getirir ve ücretsiz katmanda
kişisel finansal verinin insan incelemesine açık olması bu yükün en hassas
noktasıdır. Karar bu riski kullanıcıya şeffaf biçimde devretmeyi seçer; hukuki
uygunluk incelemesi, canlı gizlilik sitesinin güncellenmesi ve Play Console
Data safety formunun bu metne göre doldurulması bu ADR ile yapılmış olmaz.
Çeviri metinlerinin kullanıcı kabulü de alınmamıştır.

## Doğrulama

`confirmAiTransfer`, `ScannerScreen`, `ProductMatchingScreen` ve `localeParity`
regresyonları; `npm run typecheck` ve tam Jest paketi. Ayrı kalan işler: cihazda
dört dilde onay öncesi sıfır ağ isteği kaydı, canlı `privacy-policy` yayını ve
Play Data safety beyanının karşılaştırması. Sonuçlar
[düzeltme kaydında](../evidence/SECURITY_REMEDIATION_2026-09-16.md).
