# ADR-001: Tema ve başlangıç yüzeyi sürekliliği

- **Status:** Accepted
- **Kayıt türü:** Retrospective
- **Kayda geçirildi:** 1 Ağustos 2026
- **Özgün karar tarihi:** Bilinmiyor; `docs/history/DESIGN_BRIEF_LEGACY_2026-08-01.md` P12/P15/P18/P20 kayıtları Nisan–Temmuz 2026 dönemini işaret ediyor.
- **Özgün commit:** Bilinmiyor

## Bağlam

SPARK'ta uygulama içi tema tercihi geçmişte native `Appearance.setColorScheme()` kanalına bağlanmıştı. Android'de bu kanal `uiMode`/Activity yeniden oluşturması üretebiliyor; aynı anda DB'den tema, dil, para birimi ve onboarding rotası farklı async karelerde çözülünce siyah, beyaz ve yanlış temalı yüzeyler art arda görünüyordu. Tema okunmadan oluşturulan StyleSheet değerleri de eski şemada donabiliyordu.

Benzer süreksizlik transient bildirimlerde de görüldü: her toast için native Modal açmak tam ekran dim/flicker ve replacement callback yarışı oluşturuyordu.

## Karar

1. Uygulama teması için tek gerçek kaynak `src/theme/themeStore.ts` içindeki React external store'dur.
2. Uygulama içi manuel/zamanlanmış tema değişimi yalnız `setAppThemeScheme()` ile yapılır. `Appearance.setColorScheme()` kullanılmaz.
3. Tema duyarlı component `useAppTheme()` kullanır ve tema ile çözülen StyleSheet'i `useMemo(() => getStyles(), [scheme])` ile yeniden üretir.
4. Aktif SPARK paleti React Navigation `ThemeProvider` context'ine de aktarılır. Stack, pager ve scene wrapper'ları uygulama ekranından farklı bir varsayılan tema kullanamaz; lazy placeholder aktif tema renginde opak kalır.
5. Native splash otomatik kapanmaz. DB init/seed, kayıtlı tema, dil sözlüğü, para birimi, onboarding hedef rotası ve root layout hazır olana kadar native splash ile aynı `#050505` JS `BootSurface` görünür.
6. Başlangıç rotası opak perde altında animasyonsuz düzeltilir; iki commit frame'i sonrasında tek reveal fade yapılır.
7. Provider'lar yüklenirken çocukları `null` yapmaz. Hazır olma sinyalleri root reveal gate'inde toplanır.
8. Transient başarı/bilgi geri bildirimi yeni native Modal açmak yerine kalıcı React overlay host üzerinde gösterilir; native sheet içindeyken modal-local host devamlılığı korunur.

## Değişmezler

- Yeni bir DB tercihi ilk görünür kareyi etkiliyorsa root readiness gate'ine eklenir.
- Native splash, System UI background ve JS BootSurface başlangıç yüzeyi birbiriyle eşleşir.
- `Colors` proxy tek başına reaktivite sağlamaz; tema bağımlılığı StyleSheet memo deps'inde açıkça bulunur.
- React Navigation scene rengi, ekran kökünden bağımsız görünür olabileceği için tema context'i ve lazy placeholder açıkça eşleştirilir.
- Tema scheduler sonucu latest-wins olmalıdır; geç tamamlanan eski okuma yeni kullanıcı tercihini geri çeviremez.
- Kart/list mount animasyonu splash veya notification flicker'ını geri getirecek biçimde topluca eklenmez.
- ErrorBoundary, hata durumunda native splash'in sonsuza kadar açık kalmasını engeller.

## Sonuçlar ve ödünleşimler

**Olumlu:** Android Activity recreation azaltılır; ilk görünür kare tek yüzeydir; light/dark stiller aynı React ağacı içinde güncellenir; toast replacement kesintisizdir.

**Bedel:** Root layout daha fazla readiness sinyalini orkestre eder. Yeni provider veya rota eklendiğinde yalnız kendi loading state'ini çözmek yetmez; reveal sözleşmesine etkisi de değerlendirilir. Native tema gerektiren üçüncü taraf entegrasyonları ayrıca sınırlandırılmalıdır.

## Doğrulama

- Otomatik: tema latest-wins, navigation theme eşlemesi, light/dark lazy scene yüzeyi, mounted Tarayıcı tema değişimi, LanguageProvider yüzey sürekliliği, SparkToast replacement/modal-host testleri ve `npm run typecheck`.
- Native: cold start, light/dark kayıtlı tercih, ilk kurulum/onboarding rotası, ilk ziyaret edilen lazy sekmeler, uzak sekmeye doğrudan dokunma, iki yönlü swipe, Samsung/Android modal ve gerçek APK üzerinde görsel kontrol. Jest fiziksel ilk kareyi veya PagerView kompozisyonunu tek başına doğrulamaz.

## Kanıt

- `src/theme/themeStore.ts`
- `src/theme/colors.ts`
- `src/theme/navigationTheme.ts`
- `src/utils/themeSchedule.ts`
- `src/hooks/useDatabase.ts`
- `app/_layout.tsx`
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/scanner.tsx`
- `src/i18n/LanguageContext.tsx`
- `src/context/CurrencyContext.tsx`
- `src/components/SparkToast.tsx`
- `docs/history/DESIGN_BRIEF_LEGACY_2026-08-01.md` P12, P15, P18, P20

## Yeniden değerlendirme koşulları

Expo/React Native uygulama teması için Activity recreation üretmeyen, fiziksel cihazda kanıtlanmış yeni bir native API sunarsa veya root startup mimarisi tamamen değişirse yeni bir ADR ile değerlendirilir.
