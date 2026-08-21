# SPARK Geliştirme Rehberi

Bu rehber SPARK'ı güvenli ve tutarlı biçimde değiştirme kurallarını tanımlar. Mimari gerekçeler [`ARCHITECTURE.md`](ARCHITECTURE.md), doğrulama ve güvenlik gereksinimleri [`QUALITY_AND_SECURITY.md`](QUALITY_AND_SECURITY.md) içindedir.

## Kaynak sahipliği

Çalıştırılabilir bir kaynak gerçeğin sahibiyse değişken bilgileri açıklama metnine kopyalamayın.

| Bilgi | Yetkili kaynak |
|---|---|
| Bağımlılık sürümleri ve npm script'leri | [`package.json`](../package.json) ve `package-lock.json` |
| Expo metaverisi, izinler, ikonlar ve tanımlayıcılar | [`app.json`](../app.json) ve [`app.config.js`](../app.config.js) |
| Bulut derleme profilleri | [`eas.json`](../eas.json) |
| Test ve type-check sırası | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| Veritabanı biçimi | [`src/db/schema.ts`](../src/db/schema.ts) |
| Çalışma zamanı navigasyonu | [`app/`](../app) |
| Tema token'ları | [`src/theme/`](../src/theme) |
| Çeviri anahtar kümesi | [`src/i18n/translations.ts`](../src/i18n/translations.ts) ve locale kaynak haritaları |

Bir komut, izin, sürüm veya anahtar sayısı değişirse önce sahibi güncellenmelidir. Dokümantasyon ikinci bir kopya saklamak yerine akışı açıklamalı ve sahibine bağlantı vermelidir.

## Yerel çalışma akışı

CI tarafından yapılandırılan Node major sürümünü kullanın. Lockfile üzerinden kurulum yapın ve `package.json` içindeki npm script'lerini çalıştırın:

```bash
npm ci
npm start
npm run android
npm run ios
npm test
npm run typecheck
```

Her değişiklik tüm runtime komutlarını gerektirmez. Her kod değişikliği en azından etkilenen alanın odaklı testlerini ve TypeScript kontrolünü çalıştırmalıdır; teslimden önce ortam engeli kaydedilmediği sürece tam otomatik test paketi çalıştırılmalıdır.

Splash sürekliliği, gesture, izinler, kamera, paylaşım, bildirimler veya SQLite yaşam döngüsü gibi native davranışlarda cihaz ya da APK smoke kontrolü ekleyin; Jest mock'ları native davranışı kanıtlayamaz.

## Değişiklik çalışma akışı

1. Değişikliğin sahibi olan katmanı belirleyin; ilgili mimari ve kalite bölümlerini okuyun.
2. Yeni bir desen eklemeden önce yakındaki uygulamaları ve testleri inceleyin.
3. Değişikliği sınırlı tutun; çalışma ağacındaki ilgisiz değişiklikleri koruyun.
4. Özellik bu sınırları aşıyorsa domain mantığını, kalıcılığı, UI'ı, çevirileri ve dokümantasyonu birlikte güncelleyin.
5. En küçük anlamlı regresyon testini ekleyin veya güncelleyin.
6. Önce odaklı doğrulamayı, sonra depo kalite kapılarını çalıştırın.
7. Çalıştırılamayan doğrulamaları ve nedenini bildirin.

## React ve ekran bileşimi

- Route dosyaları navigasyonu ve ekran seviyesindeki veriyi koordine eder.
- Yeniden kullanılabilir görsel davranış `src/components` içinde bulunur.
- Paylaşılan durum yalnız birden fazla route ihtiyaç duyuyorsa odaklı bir context'e taşınır; yerel ekran durumu yerel kalmalıdır.
- İş matematiği ve normalizasyon JSX içine gömülmek yerine `src/utils` veya odaklı bir serviste bulunmalıdır.
- Büyük ekranları bağımsız, memoize bölümler çıkararak orkestratör olarak tutun.
- Memoize child'lar için kararlı key'ler ve kararlı callback/nesne referansları kullanın.

### Context kuralları

- Her provider `value` değerini `useMemo` ile memoize edin.
- Dışarı açılan callback'leri doğru bağımlılıklarla `useCallback` kullanarak memoize edin.
- Geniş invalidation gizli ekranları yeniden render edecekse sık değişen durumu kararlı action kanallarından ayırın.
- Çakışabilen async yenilemeler React state yazmadan önce latest-wins korumasına sahip olmalıdır.

## Tema ve görsel sistem

[`src/theme/themeStore.ts`](../src/theme/themeStore.ts) içindeki çalışma zamanı
tema mağazası uygulama temasının yetkili kaynağıdır. Yetkili snapshot görünüm
şemasını, vurgu kimliğini, çözülmüş paleti ve revision'ı birlikte taşır.

Yalnız açık/koyu yüzey kullanan component mevcut uygulama şemasını; vurgu token'ı
kullanan component ise tam paleti veya revision'ı izlemelidir:

```tsx
const scheme = useAppTheme();
const styles = useMemo(() => getStyles(), [scheme]);

const palette = useThemePalette();
const styles = useMemo(() => getStyles(palette), [palette]);

// Colors proxy kullanan mevcut getStyles fabrikaları için:
const revision = useThemeRevision();
const styles = useMemo(() => getStyles(), [scheme, revision]);
```

`getStyles` açıkça tema nesnesi veya `isDark` parametresi alacak şekilde
tasarlanmışsa parametreli eşdeğer kalıp kullanılabilir. Bağımlılık dizisi,
fonksiyonun okuduğu bütün tema eksenlerini izlemelidir; yalnız `[scheme]`, vurgu
token'ı kullanan bir StyleSheet için yeterli değildir.

Kurallar:

- `Colors` proxy değerlerini modül seviyesindeki `StyleSheet.create` içine hapsetmeyin; bu değerler yanlış şemada donabilir.
- Uygulama içi tema değişiklikleri için `Appearance.setColorScheme` kullanmayın. Android activity'sini yeniden oluşturup açılış/tema flicker sorununu geri getirebilir.
- Kalıcı şema ve vurgu tercihini başlangıçta ayrı ara render'lara sızdırmayın; DB readiness içinde birlikte okuyup tek snapshot olarak uygulayın.
- Vurgu değişiminde root navigator'a `key` vermeyin veya navigation ağacını yeniden mount etmeyin. Aktif rota, sheet ve gesture durumu korunurken theme context'i güncellenmelidir.
- Route arka planları, modal yüzeyleri, status-bar stili ve yükleme yüzeyleri aynı uygulama temasından çözülmelidir.
- React Navigation renk context'i [`src/theme/navigationTheme.ts`](../src/theme/navigationTheme.ts) üzerinden aktif SPARK şemasıyla eşleşmelidir. Nested navigator eklerken varsayılan `DefaultTheme` arka planına güvenmeyin.
- Lazy sekmelerde `sceneStyle` ve `lazyPlaceholder` aktif tema renginde opak kalmalıdır. Flicker'ı gizlemek için lazy loading veya geçiş animasyonunu kapatmak yerine ara yüzeyin temasını düzeltin.
- Yeni birincil CTA'lar `src/theme/susevar.ts` içindeki runtime palet fabrikasını kullanmalıdır. Dolu eylem yüzeyi `primaryAction`, üzerindeki metin/ikon `onPrimary` olmalıdır; yalnız dekoratif `primary` tonuna beyaz metin varsaymayın.
- `success`, `danger`, `warning` ve `info` kullanıcı vurgusu değildir. Kategori, grafik serisi, logo ve splash renklerini vurgu seçimine bağlamayın.
- Yeni vurgu değeri eklemek yalnız bir hex eklemek değildir: açık/koyu display ve action tonları, `onPrimary` kontrastı, ayar çevirileri, geçersiz tercih fallback'i ve cihaz matrisi birlikte ele alınır.
- Glass yüzey dilini ayrı hardcoded renkler yerine tema token'larıyla koruyun.
- Safe-area inset'lerine uyun; cihaza özgü alt boşluğu sabit padding ile taklit etmeyin.

## Animasyon ve gesture'lar

- Yeni UI-thread animasyonlarında React Native Reanimated kullanın.
- Animasyon listener'larının tetiklediği JS-frame `setState` döngülerinden kaçının.
- Gesture ile çalışan component'lerde Gesture Handler kullanın ve kök gesture host'unu koruyun.
- Yıkıcı bir gesture belirsiz sürüklemede doğrudan silmek yerine açık bir eylem veya onay göstermelidir.
- Seçim modları çakışan swipe, refresh ve navigasyon gesture'larını devre dışı bırakmalıdır.
- State geçişleri ile callback'leri Jest'te, fiziksel hareket ve interruption davranışını cihazda doğrulayın.

## Sheet, dialog ve geri bildirim

- Yeni bottom sheet'ler [`src/components/BottomSheetModal.tsx`](../src/components/BottomSheetModal.tsx) kullanmalıdır.
- Bir ekranı aşması beklenen, birden çok klavye alanı içeren create/edit formları yüzde-yükseklikli sheet'e sıkıştırmayın. Safe-area içinde sabit başlıklı ve yalnız gövdesi kaydırılan gerçek card route kullanın.
- İkinci statik tutamaç render etmek yerine ortak handle davranışını kullanın.
- Yıkıcı işlemler ortak onay yüzeyini ve danger token'larını kullanmalıdır.
- Toast'lar kalıcı `SparkToast` host'unu kullanmalıdır. Kısa süreli geri bildirim için geçici native `Modal` oluşturmayın; native pencere churn'ü daha önce flicker üretmiştir.
- Android back, backdrop dokunuşu, gesture ile kapatma ve action ile kapatma tek bir kapanış yolunda birleşmelidir.

## Listeler ve seçim

- Uzun koleksiyonlarda `FlatList`/`SectionList` virtualization kullanın; iç içe dizileri eager biçimde render etmeyin.
- Veri anlamlı biçimde büyüyebiliyorsa veritabanı sınırında sayfalama yapın.
- `renderItem`, `keyExtractor`, boş/footer component'leri ve satır callback'lerini referans bakımından kararlı tutun.
- Android'de `removeClippedSubviews` değerini çalışma zamanında değiştirip durmayın; kırpılmış native satırlar mod değişince geri gelmeyebilir.
- Drag seçimi veya `getItemLayout` için satır geometrisi gerekiyorsa hit testing ile layout aynı runtime ölçümlerini paylaşmalıdır.
- Aranabilir listeler, ilk satır dokunuşunun klavye kapatmaya harcanmaması için `keyboardShouldPersistTaps="handled"` kullanmalıdır.
- Seçime giriş, öğe toggle, toplu eylem, iptal, back davranışı ve refresh kilidi tek state machine olarak tasarlanmalıdır.

## SQLite ve DAO çalışmaları

Tüm uygulama verisi [`src/db/database.ts`](../src/db/database.ts) tarafından döndürülen ortak bağlantıyı kullanır.

- SQL sunum component'lerinde değil DAO'larda bulunmalıdır.
- İki veya daha fazla ilişkili yazmayı tek transaction içinde çalıştırın.
- Mutasyon argümanlarını DAO veya servis sınırında doğrulayın ve sanitize edin.
- Foreign-key davranışını koruyun; yeni tekrarlayan filtre veya join'ler için index ekleyin.
- Şema kurulumu ve uyumluluk migration'larını idempotent tutun; mevcut kurulum upgrade'den sağ çıkmalıdır.
- Paylaşılan Expo SQLite bağlantısına karşı eşzamanlı `prepareAsync` işini `Promise.all` ile başlatmayın. Mevcut runtime released-shared-object hatası göstermiştir; bağımlı ve aynı bağlantıdaki sorguları seri çalıştırın.
- N+1 sorgu döngüsü yerine tekrarlayan okuma/yazmaları toplu işleyin.
- Bir şema değişikliği yedek/export/import incelemesi ve regresyon kapsamı gerektirir.

## Finansal özellik değişiklikleri

Formülleri ekranlarda tekrarlamak yerine kanonik helper'ları kullanın.

- Bütçe dönemlerinin kaynağı `src/utils/budgetCycle.ts` dosyasıdır.
- Harcanabilir bütçenin kaynağı `src/utils/debtMath.ts` dosyasıdır.
- Borç alma, geri ödeme, ek gelir ve tüketim farklı domain olaylarıdır.
- Açık borç bir döngü harcaması değildir.
- Kullanıcı ürünleri açıkça düzenlemediği sürece fiş başlık toplamı tarama importundan sonra yetkili kalır.
- Yeni parasal girdiler merkezi tutar, metin, tarih ve tanımlayıcı sanitizer'larını kullanmalıdır.
- Para toplamı ve indirimi için ham kayan nokta toplama/çıkarma yapmayın; `src/utils/moneyMath.ts` minor-unit yardımcılarını kullanın. `quantity` ve birim oranını toplam para tutarından ayrı hassasiyetle ele alın.
- Düzenlenebilir para alanlarını kalıcı `number.toString()` ile doldurmayın; kanonik para-input formatter'ı kullanın.

Harcanabilir nakdi değiştiren yeni kaynak eklerken budget hook, dashboard, analiz projeksiyonu, bildirim kuralları, para biçimlendirme, çeviriler ve testleri birlikte inceleyin.

## i18n çalışma akışı

Tüm görünür ürün metinleri Türkçe, İngilizce, Azerbaycanca ve Rusça çevrilebilir olmalıdır.

### Dosya rolleri

- `src/i18n/translations.ts`: çalışma zamanı çeviri bileşimi ve inline Türkçe/İngilizce sözlükler.
- `src/i18n/locales/_en.json`: dış locale artifact'leri oluşturulurken kullanılan İngilizce kaynak sözlük.
- `src/i18n/locales/map-az-*.json` ve `map-ru-*.json`: insan tarafından yönetilen Azerbaycanca ve Rusça çeviri parçaları.
- `az-partial.json` ve `ru-partial.json`: üretilen birleştirilmiş kısmi sözlükler.
- `az.json` ve `ru.json`: üretilen eksiksiz runtime sözlükleri.
- `_parityBaseline.json`: parity guard durumu; yeni eksikleri gizlemek için büyütmeyin.

### Anahtar ekleme

1. Türkçe ve İngilizce girdileri `translations.ts` içine ekleyin.
2. `_en.json` dosyasını aynı anahtar ve İngilizce değerle hizalı tutun.
3. Azerbaycanca ve Rusça değerleri uygun numaralı `map-*` kaynak dosyalarına ekleyin.
4. Üretilen locale dosyalarını yeniden oluşturun:

   ```bash
   node src/i18n/compilePartial.mjs
   node src/i18n/buildLocales.mjs
   ```

5. Locale parity testini, ardından normal test paketini çalıştırın.

`az.json`, `ru.json` veya partial dosyaları bir çevirinin tek kaynağı olacak şekilde düzenlenmemelidir; sonraki build bunların üzerine yazar. Interpolation placeholder'larını aynen koruyun. Yüzde için literal yüzde işaretini placeholder'dan sonra yerleştirin (`{pct}%`); para birimi sembolünü hardcode etmek yerine biçimlendirilmiş para değerini çeviriye aktarın.

## Dış servisler ve native API'ler

- Gemini'ye yalnız mevcut servis ve güvenli anahtar wrapper'ı üzerinden erişin.
- İptal sinyallerini görsel ayrıştırma isteklerine kadar taşıyın.
- API anahtarlarını URL, SQLite, log, analytics veya hata metninden uzak tutun.
- Android'de Expo Go içinde kullanılamayan bildirim davranışlarını guard ile koruyun.
- Kamera, galeri, filesystem, share sheet ve bildirim değişiklikleri native cihaz doğrulaması ile izin incelemesi gerektirir.
- Backup import değişiklikleri desteklenen eski payload sürümleriyle uyumluluğu korumalıdır.

## Özelliğe göre koordinasyon kontrol listesi

| Değişiklik | Ayrıca incelenecekler |
|---|---|
| Yeni route veya startup provider | Root stack, startup readiness, arka plan sürekliliği, back davranışı |
| Tema token'ı, vurgu paleti veya scheduler | Theme store tam snapshot/revision, memoize stiller, startup perdesi, navigation context'i, semantik renk ayrımı, açık/koyu × vurgu cihaz kontrolleri |
| Yeni veritabanı tablosu/kolonu | Şema init, uyumluluk migration'ı, DAO, backup/restore, index'ler, testler |
| Yeni analiz kartı | Kart registry/sıra migration'ı, memoize prop'lar, ortak stiller, i18n, boş durumlar |
| Yeni bildirim kuralı | Tip, feed builder, mute channel, dismissal kalıcılığı, Expo Go guard, testler |
| Yeni çevrilen metin | TR/EN kaynakları, AZ/RU map'leri, locale build, parity testi, dört dilde yerleşim |
| Yeni fiş alanı | Gemini coercion, onarım/doğrulama, önizleme, kalıcılık, backup, düzenleme davranışı |
| Yeni yıkıcı eylem | Onay/geri alma stratejisi, atomik mutasyon, tekrar dokunma guard'ı, erişilebilirlik |

## Dokümantasyon bakımı

Kalıcı sınırlar veya domain semantiği değiştiğinde [`ARCHITECTURE.md`](ARCHITECTURE.md), katkı akışları ya da kod kuralları değiştiğinde bu rehber, kalite kapısı, tehdit sınırı veya yayın doğrulama gereksinimi değiştiğinde [`QUALITY_AND_SECURITY.md`](QUALITY_AND_SECURITY.md) güncellenmelidir.

Bu belgelere kesin bağımlılık patch sürümleri veya elle tutulan test sayıları eklemeyin; bunların çalıştırılabilir sahipleri yukarıda listelenmiştir.
