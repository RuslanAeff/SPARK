// S.P.A.R.K. — Fiş Görüntüsü Sıkıştırma
// P3: Gemini'ye göndermeden önce görüntüyü küçültür ve sıkıştırır.
// Latency, bellek ve bant genişliği tasarrufu sağlar.
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

/** Gemini API için görüntü boyut sınırları */
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.82;
const IMAGE_PROCESSING_TIMEOUT_MS = 25_000;

export interface CompressImageOptions {
  width?: number;
  height?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function abortError(): Error {
  const error = new Error('Operation aborted');
  error.name = 'AbortError';
  return error;
}

function runControlled<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<T> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('IMAGE_PROCESSING_TIMEOUT'));
    }, timeoutMs);
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

/** En uzun kenarı küçültür; küçük görüntüyü hiçbir zaman büyütmez. */
export function buildReceiptResizeAction(
  width?: number,
  height?: number,
): Array<{ resize: { width?: number; height?: number } }> {
  if (!width || !height || width <= 0 || height <= 0) return [];
  const longest = Math.max(width, height);
  if (longest <= MAX_DIMENSION) return [];
  return width >= height
    ? [{ resize: { width: MAX_DIMENSION } }]
    : [{ resize: { height: MAX_DIMENSION } }];
}

/**
 * Bir görüntü URI'sini küçültüp sıkıştırarak base64 string'e çevirir.
 * - En uzun kenar gerekirse 2048px'e küçültülür; küçük görsel büyütülmez
 * - Tek JPEG dönüşümü %82 kaliteyle yapılır
 * - Orijinal görüntüyü değiştirmez
 */
export async function compressImageToBase64(
  uri: string,
  options: CompressImageOptions = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? IMAGE_PROCESSING_TIMEOUT_MS;
  let temporaryUri: string | null = null;
  try {
    const manipulated = await runControlled(
      ImageManipulator.manipulateAsync(
        uri,
        buildReceiptResizeAction(options.width, options.height),
        {
          compress: JPEG_QUALITY,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      ),
      options.signal,
      timeoutMs,
    );
    temporaryUri = manipulated.uri !== uri ? manipulated.uri : null;

    return await runControlled(
      FileSystem.readAsStringAsync(manipulated.uri, { encoding: 'base64' }),
      options.signal,
      timeoutMs,
    );
  } finally {
    if (temporaryUri) {
      try {
        await FileSystem.deleteAsync(temporaryUri, { idempotent: true });
      } catch {
        // Geçici dosya temizliği ana tarama sonucunu bozmamalı.
      }
    }
  }
}
