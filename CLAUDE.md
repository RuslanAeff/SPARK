# CLAUDE.md — S.P.A.R.K için yönlendirme

> Bu dosya Claude Code tarafından her oturum başında otomatik okunur.
> Detaylı teknik/tasarım rehberi için **`DESIGN_BRIEF.md`** ana kaynaktır — bir görev başlamadan önce ilgili bölümlerini oku.

---

## Proje özeti

**S.P.A.R.K** — kişisel harcama takibi mobil uygulaması (mağaza sürümü örn. **2.2.0** — `app.json` / `package.json`).
- **Yığın:** Expo SDK ~55, expo-router (file-based), React 19, RN 0.83
- **Veri:** expo-sqlite (`spark.db`, WAL, FK on)
- **Yapay zekâ:** Google Gemini (fiş ayrıştırma)
- **Diller:** TR (varsayılan), EN, AZ, RU

## Mimari özet

```
app/                    # Ekranlar (expo-router)
  (tabs)/               # Dashboard, İşlemler, Tarayıcı, Analiz (`analytics.tsx` — kart kataloğu §5.8), Ayarlar
src/
  components/           # Ortak UI
  context/              # Currency, Refresh, Notifications, Language
  db/                   # schema, database, DAO'lar
  hooks/                # useExpenses, useBudget, useDatabase, ...
  i18n/                 # locales/ (TR inline + EN/AZ/RU JSON)
  services/             # gemini, receiptParser, backupService, subscriptionDetector, ...
  notifications/        # feed + kural motoru
  theme/                # colors, spacing, typography, susevar, themeStore
  utils/                # tarih, para, validation, imageCompressor, ...
```

## Kritik kurallar (bunları **mutlaka** uygula)

### 1. Tema (en sık unutulan)
- **Asla** modül seviyesinde `StyleSheet.create({ ...Colors.x })` yazma — tema değişiminde donar.
- Tema duyarlı her component şu kalıbı kullanmalı:
  ```ts
  const scheme = useAppTheme();              // src/theme/themeStore
  const styles = useMemo(() => getStyles(scheme), [scheme]);
  ```
- Detay: `DESIGN_BRIEF.md` §6.1.2 (P12 regresyonu).

### 2. Güvenlik
- Gemini API anahtarı **sadece** `expo-secure-store` (OS keychain) — SQLite'a yazma.
- Tüm dış girdi (fiş JSON, backup JSON) `src/utils/inputValidation.ts` (`stripDangerousKeys` + sanitize) üzerinden geçer.
- Gemini header: `x-goog-api-key` (URL'e koyma).

### 3. Veritabanı işlemleri
- Çoklu yazma her zaman `db.withTransactionAsync(...)` içinde — yarım import/güncelleme yok.
- Şema değişikliğinde migration ekle (`src/db/database.ts`).

### 4. i18n
- TR varsayılan; tüm metinler `t('...')` ile çevirilebilir olmalı.
- Dört dilin tamamına anahtar eklenmeli: `src/i18n/locales/{en,az,ru}.json` (TR inline `translations.ts`).

### 5. Tasarım
- Birincil CTA: **şüşevar** (`src/theme/susevar`). Cam kart hissi (glass).
- Animasyon: **react-native-reanimated 4** (eski `Animated`'ı yenisinde kullanma).

### 6. Bildirimler
- Expo Go Android'de `expo-notifications` push API yüklenmez → `isRunningInExpoGo()` guard'ı zorunlu.
- Yeni kural eklerken: tür bazlı sessize alma (mute channel) eklemeyi unutma.

## Komutlar

```powershell
npm start              # expo start
npm run android        # expo run:android
npm run ios            # expo run:ios
```

## İletişim

- Kullanıcı **Türkçe** konuşuyor — cevapları Türkçe ver.
- Detaylı kural/akış sorulduğunda `DESIGN_BRIEF.md`'nin ilgili bölümünü oku, ezberden cevap verme (rehber kod tabanıyla senkron).

## Bir göreve başlamadan önce

1. Görev hangi alana giriyor? → `DESIGN_BRIEF.md` ilgili bölümünü oku (içindekiler tablosuna bak).
2. Tema/güvenlik/DB dokunan iş mi? → Yukarıdaki "Kritik kurallar"a tekrar göz at.
3. UI değişikliği mi? → şüşevar + cam kart + dört dil + tema kalıbı.
4. Analiz sekmesi / yeni kart / `analytics_card_order` mi? → `DESIGN_BRIEF.md` §5.8 (ALL_CARDS, DEFAULT_ACTIVE, `loadCardConfig`, i18n).
