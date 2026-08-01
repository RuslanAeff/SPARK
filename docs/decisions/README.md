# S.P.A.R.K. Mimari Karar Kayıtları

Bu dizin, birden fazla ekran veya katmanı etkileyen ve yanlışlıkla geri alınması yüksek regresyon riski taşıyan kararları tutar. Ayrıntılı ürün/UX rehberi `DESIGN_BRIEF.md`, geçmişte kapatılmış bulgular ise [`ENGINEERING_HISTORY_2026.md`](../history/ENGINEERING_HISTORY_2026.md) içindedir.

## Kayıt biçimi

- `Accepted`: mevcut mimarinin parçası ve yeni işlerde varsayılan.
- `Proposed`: henüz uygulanmamış karar önerisi.
- `Superseded`: yeni ADR ile değiştirilmiş; dosya geçmiş için korunur.
- `Deprecated`: yeni kullanım için uygun değil, ancak henüz tamamen kaldırılmamış olabilir.
- `Retrospective`: ayrı bir status değil; kararın uygulamadan sonra belgelendiğini ve özgün tarih/commit kanıtının sınırlı olduğunu belirtir.

Bir kararı değiştirirken eski ADR sessizce yeniden yazılmaz. Yeni ADR oluşturulur, eski kaydın status'u `Superseded` yapılır ve iki kayıt birbirine bağlanır. Küçük uygulama ayrıntıları için ADR üretilmez.

## Aktif kararlar

| ADR | Status | Kapsam | Neden yüksek değerli? |
|---|---|---|---|
| [ADR-001](ADR-001-theme-and-startup-continuity.md) | Accepted · retrospective | Tema mağazası, splash/reveal, transient overlay | Android Activity recreation ve ilk-kare flicker regresyonunu engeller. |
| [ADR-002](ADR-002-sqlite-concurrency-and-transactions.md) | Accepted · retrospective | DB init, seri sorgular, atomik yazılar, notification mutation queue | Temiz kurulum çökmesini, lost update ve kısmi finansal kayıtları engeller. |
| [ADR-003](ADR-003-financial-cash-flow-domain.md) | Accepted · retrospective | Harcama, borç, borç ödemesi, ek gelir, bütçe döngüsü | Tüketim ile nakit akışının karışmasını ve silinen kaydın etkisinin kalmasını engeller. |
| [ADR-004](ADR-004-receipt-total-integrity.md) | Accepted · retrospective | Gemini fişi, header/items transaction'ı, edit semantiği | AI eksik kalem çıkarsa bile gerçek ödenen toplamı korur. |
| [ADR-005](ADR-005-generated-locale-sources.md) | Accepted · retrospective | TR/EN/AZ/RU sözlükleri ve üretim akışı | Üretilmiş locale dosyalarındaki sessiz çeviri kaybını önler. |

## ADR ekleme kontrol listesi

1. Kararın birden fazla bileşen/katmanı etkilediğini doğrula.
2. Context, decision, invariants, consequences ve verification bölümlerini doldur.
3. Özgün karar sonradan kayda geçiriliyorsa `retrospective` yaz; bilinmeyen tarih veya commit üretme.
4. Kaynak kod, test ve ilgili rehber yollarını kanıt olarak ekle.
5. Uygulama davranışını değiştiren ADR ile kod/test değişikliklerini aynı çalışma kapsamında doğrula.

