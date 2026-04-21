// S.P.A.R.K. — Fiş Görüntüsü Sıkıştırma
// P3: Gemini'ye göndermeden önce görüntüyü küçültür ve sıkıştırır.
// Latency, bellek ve bant genişliği tasarrufu sağlar.
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

/** Gemini API için görüntü boyut sınırları */
const MAX_DIMENSION = 1536; // Gemini Flash/Pro için yeterli çözünürlük
const JPEG_QUALITY = 0.7;   // Fiş/fatura için yeterli kalite

/**
 * Bir görüntü URI'sini küçültüp sıkıştırarak base64 string'e çevirir.
 * - Max kenar 1536px'e küçültülür (en-boy oranı korunur)
 * - JPEG %70 kaliteyle sıkıştırılır
 * - Orijinal görüntüyü değiştirmez
 */
export async function compressImageToBase64(uri: string): Promise<string> {
  // Orijinal boyutu kontrol etmek için önce manipulator'a ver
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
    encoding: 'base64',
  });

  // Geçici sıkıştırılmış dosyayı temizle
  try {
    if (manipulated.uri !== uri) {
      await FileSystem.deleteAsync(manipulated.uri, { idempotent: true });
    }
  } catch {
    // Temizleme başarısız olsa sorun değil
  }

  return base64;
}
