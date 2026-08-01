# CLAUDE.md — Claude Code başlangıç adaptörü

Bu depo için ortak ve kanonik ajan kuralları `AGENTS.md` içindedir. Her görevin başında önce onu oku ve uygula.

Ardından görevin kapsamına göre:

- Ürün ve UX niyeti: `DESIGN_BRIEF.md`
- Sistem mimarisi ve domain sınırları: `docs/ARCHITECTURE.md`
- Uygulama kalıpları ve komutlar: `docs/DEVELOPMENT_GUIDE.md`
- Test, cihaz doğrulaması ve güvenlik: `docs/QUALITY_AND_SECURITY.md`
- Karar gerekçeleri: `docs/decisions/README.md`

## Claude Code için kısa çalışma sırası

1. Mevcut kullanıcı değişikliklerini `git status --short` ile belirle; ilgisiz değişiklikleri geri alma.
2. İlgili belgeyi ve gerçek kod/config kaynağını birlikte incele.
3. Türkçe iletişim kur ve kapsamı küçük, doğrulanabilir parçalarda uygula.
4. Değişiklikten sonra `npm run typecheck` ile ilgili Jest testlerini çalıştır; native davranış gerekiyorsa cihaz doğrulamasını ayrıca belirt.
5. Mimari veya tez açısından önemli bir karar oluştuysa `AGENTS.md` içindeki izlenebilirlik kurallarını uygula.

Bu dosyada paket sürümü, test sayısı, mimari ağaç veya domain kuralı tekrarlanmaz. Bunların sahipleri yukarıdaki kanonik kaynaklardır.
