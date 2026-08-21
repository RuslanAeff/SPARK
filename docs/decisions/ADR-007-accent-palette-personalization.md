# ADR-007: Görünümden bağımsız vurgu paleti kişiselleştirmesi

- **Status:** Accepted
- **Kayıt türü:** Prospective
- **Kabul tarihi:** 13 Ağustos 2026

## Bağlam

SPARK'ın açık/koyu tema altyapısı yüzey sürekliliğini sağlıyor, ancak ürün
kimliğinin bütün etkileşim vurguları tek yeşil palete bağlıydı. Kullanıcı,
uygulamayı renk cümbüşüne çevirmeden bir rengin kontrollü tonlarıyla
kişiselleştirmek; yeşile ek olarak mavi, turuncu, mor ve kırmızı seçeneklerini
kullanmak istedi.

Vurguyu tüm renk sistemine körlemesine uygulamak iki risk taşır. Birincisi,
başarı/tehlike/uyarı gibi semantik anlamları veya kategori/grafik kimliğini
bozar. İkincisi, açık/koyu şema ile vurgu ayrı async adımlarda uygulanırsa
Android ilk-kare flicker'ı geri döner. Statik `Colors` okumaları da yalnız şema
değişimini izleyen StyleSheet'lerde eski vurguya donabilir.

Bu karar, [ADR-001](ADR-001-theme-and-startup-continuity.md) içindeki tek
readiness gate, React store ve navigation yüzeyi sürekliliğini değiştirmez;
tema snapshot'ını ikinci bir kontrollü eksenle genişletir.

## Karar

1. Görünüm şeması ile vurgu kimliği ayrı tercihlerdir. Görünüm
   `light`/`dark`; vurgu `green`/`blue`/`orange`/`purple`/`red` değerlerinden
   biridir. Otomatik görünüm zamanlaması vurgu seçimini değiştirmez.
2. Beş ürün seçeneği sırasıyla SPARK yeşili, okyanus mavisi, kehribar
   turuncusu, menekşe moru ve yakut kırmızısıdır. Serbest hex veya sınırsız
   kullanıcı paleti kabul edilmez; her seçenek açık/koyu ve action tonlarıyla
   küratörlüdür.
3. `src/theme/themeStore.ts` tek immutable snapshot içinde şema, vurgu,
   çözülmüş tam palet ve revision taşır. Vurgu değişikliği de store abonelerini
   yeniden render eder; navigator veya uygulama ağacı `key` ile yeniden mount
   edilmez.
4. `primary` vurgu gösterim tonudur. Dolu birincil eylemler kontrastı
   doğrulanmış `primaryAction` arka planı ve `onPrimary` içeriği kullanır.
   `src/theme/susevar.ts` bu runtime paletten çözülür.
5. `success`, `danger`, `warning` ve `info` semantik token'ları vurgu
   seçiminden bağımsızdır. Kategori renkleri, grafik serileri, uygulama logosu
   ve splash marka rengi de sabit kalır.
6. Kalıcı görünüm şeması ve vurgu, root DB readiness sırasında aynı sorgu
   sonucundan çözülür ve tek store güncellemesiyle atomik uygulanır. Eksik veya
   tanınmayan vurgu SPARK yeşiline normalize edilir. Görünür UI bu çözümden
   önce açılmaz.
7. Çalışma zamanı değişikliği yalnız React tema store'u ve navigation theme
   context'i üzerinden yayılır. `Appearance.setColorScheme(...)` çağrılmaz,
   Android Activity yeniden oluşturulmaz ve navigator remount edilmez.
8. Tema duyarlı UI ya çözülmüş palete doğrudan abone olur ya da StyleSheet
   fabrikasının bağımlılıklarında tam tema revision'ını izler. Modül seviyesinde
   proxy değerini donduran yeni statik stil eklenmez.
9. Vurgu gizli olmayan cihaz-yerel bir UI tercihidir. Mevcut `settings`
   anahtar/değer alanında tutulur; yeni şema migration'ı gerektirmez. Finansal
   backup'a eklenmez ve bu özellik için backup v4 oluşturulmaz.
10. Genel Ayarlar'da görünüm ve vurgu aynı seçim listesinde birleştirilmez.
    Görünüm, mevcut tam genişlikte otomatik zamanlama kontrolünü korur ve
    otomatik mod kapalıyken Açık/Koyu seçeneklerini açar. Beş vurgu, dikey
    ayar satırları yerine sabit merkez halkalı ve adım adım snap eden yatay
    carousel ile seçilir. Açıklayıcı metin seçim yüzeyini uzatmaz; ayrı bilgi
    modalında sunulur.
11. Carousel geometrisi sabit ekran varsayımına değil gerçek ScrollView
    genişliğine göre çözülür. Kullanıcının geçtiği her yeni kademe önizlemeyi
    günceller ve aynı etkileşim adımında en fazla bir best-effort platform
    haptic'i ile kısa yerel klik üretir. Hedef Samsung cihazdaki insan kabulünde
    `CLOCK_TICK` fazla hafif bulunduğu için Android'de tok tek kademe vuruşlu OEM
    `CONTEXT_CLICK`, iOS'ta `RIGID` impact uygulanır. Yerel ses, Samsung/başka
    bir OEM varlığını kopyalamayan; bas gövdesi, ikinci mandalı ve uzun rezonansı
    olmayan özgün ve yeniden üretilebilir 12 ms tiz “tik” örneğidir. Kademeler
    yaklaşık 96 dp yuva mesafesi ve 100 ms ritimle ayrılır; kaydırma kuvvetli
    frenlenir. Kalıcı DB tercihi sürükleme boyunca
    yazılmaz; yalnız son snap kademesi bir kez kalıcılaştırılır. İlk/programatik
    hizalama, kalıcı değer eşitlemesi ve başarısız yazma rollback'i ses veya
    titreşim üretmez. Ses cihazın sessiz/medya politikasına tabidir; player ya da
    haptic hatası seçimi geri almaz. Bu mikro geri bildirim için mikrofon veya
    arka plan ses/recording yeteneği açılmaz.

## Değişmezler

- Açık/koyu nötr yüzeyler vurgu seçiminden bağımsız kalır.
- Semantik bir durum yalnız kullanıcının vurgu tercihi yüzünden anlam değiştirmez.
- Dolu birincil CTA içeriği her desteklenen görünüm/vurgu kombinasyonunda
  okunabilir kontrast taşır.
- Palet değişimi aktif rota, navigation geçmişi, sheet, scroll veya gesture
  durumunu sıfırlamaz.
- Şema ve vurgu başlangıçta iki ayrı görünür karede uygulanmaz.
- Geçersiz kalıcı değer uygulamayı engellemez; güvenli varsayılan yeşildir.
- Yerel görünüm kişiselleştirmesi taşınabilir finansal verinin parçası değildir.
- Görünüm zamanlaması ile vurgu seçimi görsel olarak ayrı kalır; carousel'in
  merkez halkası, metin etiketi ve erişilebilir seçili durumu aynı adayı anlatır.
- Carousel'in ilk, orta ve son adayları desteklenen viewport genişliklerinde
  aynı merkez eksenine oturur; görsel merkez, seçili veri ve kalıcı değer
  birbirinden sapmaz.
- İçerik ölçümü, kalıcı yazma veya ekranın yeniden açılması sonrasında ray,
  kanonik vurguya sessizce yeniden hizalanır; merkez halkası ile etiket farklı
  bir adayı anlatamaz. Açık şemanın canlı gösterim tonu ile kontrastlı dolu CTA
  tonu ayrı tokenlardır.
- Kullanıcı etkileşimi başına geçilen her kademe en fazla bir geri bildirim
  üretir; programatik scroll sessizdir ve kalıcılık yalnız nihai snap'tedir.

## Sonuçlar ve ödünleşimler

**Olumlu:** Kullanıcı kontrollü kişiselleştirme ürünün sakin yüzey dilini
bozmadan sağlanır. Tek snapshot bütün ekranlar ve navigator için tutarlı renk
üretir. Semantik ve veri renkleri korunur; yeni palette de CTA kontrastı açık
bir sözleşmeye bağlanır.

**Bedel:** Tema reaktivitesi yalnız `scheme` bağımlılığıyla ifade edilemez;
vurgu token'ı kullanan bütün stiller tam paleti veya revision'ı izlemelidir.
Her yeni palet açık/koyu kontrast, dört dil, navigation sürekliliği ve fiziksel
cihaz matrisinin maliyetini artırır. Cihazlar arası yedekleme bu yerel tercihi
taşımaz. Kademeli haptic ve ses algısı platform, OEM motoru, medya/sessiz mod ve
erişilebilirlik ayarlarına göre değişebileceği için Jest ile tek başına kabul
edilemez; fiziksel cihaz matrisi gerektirir.

## Doğrulama

- Palet registry'si, geçersiz değer fallback'i, tema store reaktivitesi,
  navigation theme eşlemesi ve startup preference çözümü otomatik test edilir.
- Her açık/koyu palet için `primaryAction`/`onPrimary` kontrast eşiği otomatik
  olarak doğrulanır.
- Ayarlar ekranında yerleşik otomatik zamanlama davranışı; beş vurgunun
  dokunma, swipe/snap, adaptif merkez geometrisi, kademe başına tek geri
  bildirim, nihai snap kalıcılığı, tekrar açma ve dört dil anahtar paritesi test
  edilir.
- `npm run typecheck` başarıyla tamamlandı. Mekanik detent sonrasında görünüm,
  vurgu, ses/haptic yapılandırması ve locale kapsamındaki odaklı Jest
  doğrulaması 5/5 suite ve 40/40 test; tam Jest paketi 77/77 suite ve 665/665
  test ile geçti. Locale çıktıları yeniden üretildi; Android Metro export 1.956
  modülle tamamlandı ve yerel WAV varlığı pakete dahil edildi. `git diff
  --check` temiz sonuçlandı.
- Standalone APK'da beş vurgu × açık/koyu görünüm; cold start, çalışma zamanı
  geçişi, yeniden başlatma, aktif rota/sheet korunumu, lazy sekme ve tek-kare
  flicker video kontrolü yapılır. Carousel için ayrıca ilk/orta/son merkezleme,
  yavaş ve hızlı swipe, her gerçek kademe geçişinde tek haptic+klik algısı,
  sessiz/titreşim/medya sesi durumları ve ekran okuyucu ayarlanabilir kontrolü
  kaydedilir. Fiziksel APK kabulü beklenmektedir.

## Kanıt

- `src/theme/colors.ts`
- `src/theme/themeStore.ts`
- `src/theme/navigationTheme.ts`
- `src/theme/susevar.ts`
- `src/utils/themeSchedule.ts`
- `app/_layout.tsx`
- `app/(tabs)/_layout.tsx`
- `app/settings-general.tsx`
- `src/components/AutoThemeScheduleToggle.tsx`
- `src/components/AccentPaletteCarousel.tsx`
- `assets/audio/palette-detent.wav`
- `scripts/generate-palette-detent-audio.cjs`
- `app.json` içindeki yalnız-playback Expo Audio sınırı
- `package.json` içindeki `expo-audio` bağımlılığı
- Tema, ayar ve navigation regresyon testleri
- `docs/evidence/TRACEABILITY.md`
- `docs/evidence/AI_COLLABORATION_LOG.md`

## Yeniden değerlendirme koşulları

Serbest kullanıcı renk seçimi, bulutla tema senkronizasyonu, yeni bir semantik
renk sistemi veya native görünüm entegrasyonu istenirse bu kararın sınırları
yeni bir ADR ile yeniden değerlendirilir. Yeni vurgu eklemek yalnız registry
değişikliği sayılmaz; kontrast ve cihaz kabul kapsamını da genişletir.
