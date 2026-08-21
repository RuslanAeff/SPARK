/**
 * Şüşevar (kod adı: `susevar`)
 * ---------------------------
 * SPARK uygulamasının **birincil kayıt / onay** düğmesi görsel kimliği.
 * “KAYDET”, fiş tarama “Kaydet”, hedef ayarları kaydı vb. aynı ailededir.
 *
 * Başka ekranlarda aynı dili kullanmak için aktif paletle
 * `createSusevarStyles(palette)` çağırın. Kullanıcı veya ekip “şüşevar tarzı”
 * dediğinde bu runtime tema sözleşmesi kastedilir.
 */

import { Platform, TextStyle, ViewStyle } from 'react-native';

import { BorderRadius, Spacing } from './spacing';
import { FontFamily } from './typography';

/** Başka bir yapay zekâya / tasarımcıya aktarmak için: şüşevar stilinin tam tanımı (Türkçe). */
export const SUSEVAR_PROMPT_TR = `
ŞÜŞEVAR (kod adı: susevar) — SPARK mobil uygulaması birincil eylem düğmesi stili

Bu metin, aynı görsel dilin başka bir yapay zekâ veya tasarım aracında tutarlı üretilmesi içindir.

TANIM:
“Şüşevar”, ekranda kullanıcıyı ana olumlu eyleme (kaydet, onayla, işlemi tamamla) yönlendiren
dolgu (filled) ana düğmedir. İkincil düğmeler (çerçeveli, metin-only, hayalet) şüşevar değildir.

GÖRSEL ÖZELLİKLER:
1) Arka plan: aktif paletin kontrast güvenli ana eylem rengi (primaryAction), tam opak düz dolgu; degrade yok.
2) Şekil: tam genişlik veya blok içinde “hap” (pill): köşeler BorderRadius.round ile tam yuvarlatılmış uçlar.
3) İç boşluk: dikey Spacing.lg, yatay Spacing.xxl; içerik ortalanır (alignItems/justifyContent center).
4) Kenarlık: ince (1px) yarı saydam beyaz çerçeve — borderColor rgba(255,255,255,0.35); bu, dolgu üzerinde
   hafif “cam/parlak” ayrımı verir, özellikle aydınlık modda düğümü plakadan ayırır.
5) Gölge: iOS’ta primaryAction renginde yumuşak düşey gölge (offset ~0,6; opacity ~0.4; radius ~14);
   Android’de elevation ~10 ve shadowColor primaryAction. Amaç: düğmenin yüzeyden hafif yükselmesi, agresif değil.
6) Basılı (pressed) durum: opaklık ~0.9; devre dışı (disabled) iken opaklık düşürülür (~0.6).

METİN (ETİKET):
1) Renk: aktif paletin onPrimary tokenı; doğrudan sabit beyaz veya genel tema metni kullanılmaz.
2) Font: extraBold, yaklaşık 17pt, letter-spacing ~0.8, textTransform uppercase (ör. KAYDET, EKLE).
3) İkon varsa (ör. onay işareti): ikon da onPrimary renginde; satır flexDirection row,
   gap küçük (sm), ikon+metin birlikte ortalanır.

KULLANIM BAĞLAMI:
Form altı ana gönderim, fiş önizlemesinde kayıt, ayarlar kaydı gibi “tek doğru eylem” anları.
Tehlike eylemleri (sil, sıfırla) bu stile sokulmaz; onlar ayrı renk (ör. danger) veya ikincil stil ile kalır.

TEKNİK (React Native):
ViewStyle/TextStyle aktif runtime paletindeki primaryAction/onPrimary, BorderRadius.round,
Spacing.lg/xxl ve Platform.select gölge ile üretilir. Kaynak kodda bu paket
\`src/theme/susevar.ts\` içindeki \`createSusevarStyles(palette)\` factory'sidir;
vurgu rengi import anında dondurulmaz.
`.trim();

type SusevarPalette = {
  primaryAction: string;
  onPrimary: string;
};

/**
 * Runtime tema paletinden şüşevar stillerini üretir. Modül seviyesinde
 * `Colors.primary` okumak vurgu rengini ilk import anında dondurduğu için ana
 * CTA gövdesi ve etiketi bu factory üzerinden oluşturulmalıdır.
 */
export function createSusevarStyles(palette: SusevarPalette): {
  button: ViewStyle;
  text: TextStyle;
} {
  const shadow = Platform.select({
    ios: {
      shadowColor: palette.primaryAction,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 14,
    },
    android: {
      elevation: 10,
      shadowColor: palette.primaryAction,
    },
  });

  return {
    button: {
      backgroundColor: palette.primaryAction,
      borderRadius: BorderRadius.round,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.xxl,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      ...shadow,
    },
    text: {
      color: palette.onPrimary,
      fontFamily: FontFamily.extraBold,
      fontSize: 17,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
  };
}

/** Şüşevar — basılı durum. */
export const susevarButtonPressed: ViewStyle = {
  opacity: 0.9,
};

/** Form sonunda ana kayıt düğmesi için üst boşluk (ör. yeni harcama KAYDET). */
export const susevarButtonMarginTop: ViewStyle = {
  marginTop: Spacing.xl,
};

/** İkon + metin şüşevar (ör. tarayıcı Kaydet + check ikonu). */
export const susevarButtonRow: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: Spacing.sm,
};
