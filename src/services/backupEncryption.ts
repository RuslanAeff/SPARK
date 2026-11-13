// S.P.A.R.K. — İsteğe bağlı parolalı yedek şifrelemesi (SEC-01, ADR-018)
//
// Parola → anahtar: PBKDF2-HMAC-SHA256, 600.000 tur, uygulamanın kendi native
// modülünde (nativeKdf). Şifreleme: AES-256-GCM (expo-crypto, platformun yerel
// kriptografisi). İkisi de native; saf JS türetme cihazda ~23 sn sürüyordu.
// Zarf başlığı (biçim, KDF parametreleri, tuz) GCM'nin ek doğrulanmış verisi
// (AAD) olarak bağlanır: başlıkla oynanırsa çözme başarısız olur.
//
// Parola hiçbir yerde saklanmaz; unutulursa dosya açılamaz. Ağ çağrısı yoktur.
import * as Crypto from 'expo-crypto';
import { bytesToHex, hexToBytes, pbkdf2Sha256 } from './nativeKdf';

function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export const ENCRYPTED_BACKUP_FORMAT = 'spark-encrypted-backup';
export const ENCRYPTED_BACKUP_ENVELOPE_VERSION = 1;
export const MIN_BACKUP_PASSWORD_LENGTH = 8;
export const MAX_BACKUP_PASSWORD_LENGTH = 256;

/** Hata kodları; arayüz çevrilmiş mesajla gösterir, ham metin gösterilmez. */
export const BACKUP_PASSWORD_TOO_SHORT = 'BACKUP_PASSWORD_TOO_SHORT';
export const BACKUP_WRONG_PASSWORD = 'BACKUP_WRONG_PASSWORD';

/**
 * PBKDF2-HMAC-SHA256 600.000 tur (OWASP 2023 önerisi). Tur sayısı zarfa yazılır,
 * ileride biçim değişmeden artırılabilir. İçe aktarım kötü niyetli dosyadaki
 * aşırı tur sayısını (süre saldırısı) aşağıdaki sınırla reddeder; native taraf
 * aynı sınırı ayrıca uygular.
 */
const PBKDF2_ITERATIONS = 600_000;
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 2_000_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

export interface EncryptedBackupEnvelope {
  app: 'S.P.A.R.K.';
  format: typeof ENCRYPTED_BACKUP_FORMAT;
  envelope_version: number;
  kdf: { name: 'pbkdf2-sha256'; iterations: number; salt: string };
  cipher: 'aes-256-gcm';
  /** base64(iv || şifreli metin || etiket) */
  data: string;
}

type EnvelopeHeader = Omit<EncryptedBackupEnvelope, 'data'>;

/** Dosyanın şifreli zarf olup olmadığını (içeriğini doğrulamadan) söyler. */
export function isEncryptedBackupEnvelope(value: unknown): boolean {
  return Boolean(value) && typeof value === 'object'
    && (value as Record<string, unknown>).format === ENCRYPTED_BACKUP_FORMAT;
}

/** AAD: sabit alan sırasıyla kanonik başlık; çözmede aynı baytlar yeniden üretilir. */
function headerBytes(header: EnvelopeHeader): Uint8Array {
  return utf8ToBytes(JSON.stringify([
    header.app,
    header.format,
    header.envelope_version,
    header.kdf.name,
    header.kdf.iterations,
    header.kdf.salt,
    header.cipher,
  ]));
}

function assertPassword(password: string): void {
  if (typeof password !== 'string'
    || password.length < MIN_BACKUP_PASSWORD_LENGTH
    || password.length > MAX_BACKUP_PASSWORD_LENGTH) {
    throw new Error(BACKUP_PASSWORD_TOO_SHORT);
  }
}

async function deriveKey(password: string, header: EnvelopeHeader): Promise<Crypto.AESEncryptionKey> {
  const keyBytes = await pbkdf2Sha256(password, header.kdf.salt, header.kdf.iterations, KEY_BYTES);
  try {
    return await Crypto.AESEncryptionKey.import(keyBytes);
  } finally {
    keyBytes.fill(0);
  }
}

/** Düz yedek JSON'unu parolayla şifreler; zarfın JSON metnini döndürür. */
export async function encryptBackupJson(json: string, password: string): Promise<string> {
  assertPassword(password);
  const salt = await Crypto.getRandomBytesAsync(SALT_BYTES);
  const header: EnvelopeHeader = {
    app: 'S.P.A.R.K.',
    format: ENCRYPTED_BACKUP_FORMAT,
    envelope_version: ENCRYPTED_BACKUP_ENVELOPE_VERSION,
    kdf: { name: 'pbkdf2-sha256', iterations: PBKDF2_ITERATIONS, salt: bytesToHex(salt) },
    cipher: 'aes-256-gcm',
  };
  const key = await deriveKey(password, header);
  const sealed = await Crypto.aesEncryptAsync(utf8ToBytes(json), key, {
    additionalData: headerBytes(header),
  });
  const envelope: EncryptedBackupEnvelope = {
    ...header,
    data: await sealed.combined('base64'),
  };
  return JSON.stringify(envelope);
}

function validateEnvelope(value: unknown): EncryptedBackupEnvelope {
  const env = value as Record<string, unknown>;
  const kdf = (env?.kdf ?? {}) as Record<string, unknown>;
  if (!env || typeof env !== 'object'
    || env.app !== 'S.P.A.R.K.'
    || env.format !== ENCRYPTED_BACKUP_FORMAT
    || env.cipher !== 'aes-256-gcm'
    || typeof env.data !== 'string'
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(env.data)
    || typeof kdf.salt !== 'string'
    || !/^[0-9a-f]{32,128}$/.test(kdf.salt)
    || (kdf.name === 'pbkdf2-sha256'
      && (!Number.isInteger(kdf.iterations)
        || Number(kdf.iterations) < MIN_ITERATIONS || Number(kdf.iterations) > MAX_ITERATIONS))) {
    throw new Error('INVALID_FORMAT');
  }
  // Bilinmeyen KDF (ör. yalnız geliştirme sırasında üretilmiş scrypt dosyaları) veya
  // daha yeni zarf sürümü: bozuk değil, bu sürümün açamadığı dosya.
  if (env.envelope_version !== ENCRYPTED_BACKUP_ENVELOPE_VERSION || kdf.name !== 'pbkdf2-sha256') {
    throw new Error('UNSUPPORTED_VERSION');
  }
  // base64 uzunluğu iv + etiketten kısa olamaz.
  if (Math.floor((env.data.length * 3) / 4) < GCM_IV_BYTES + GCM_TAG_BYTES) throw new Error('INVALID_FORMAT');
  return env as unknown as EncryptedBackupEnvelope;
}

/**
 * Zarfı çözer ve düz yedek JSON metnini döndürür. Yanlış parola veya içeriği
 * değiştirilmiş dosya `BACKUP_WRONG_PASSWORD` verir (GCM ikisini ayırt etmez).
 */
export async function decryptBackupEnvelope(value: unknown, password: string): Promise<string> {
  const envelope = validateEnvelope(value);
  if (typeof password !== 'string' || !password || password.length > MAX_BACKUP_PASSWORD_LENGTH) {
    throw new Error(BACKUP_WRONG_PASSWORD);
  }
  const { data, ...header } = envelope;
  const key = await deriveKey(password, header);
  let plain: Uint8Array;
  try {
    const sealed = Crypto.AESSealedData.fromCombined(data, {
      ivLength: GCM_IV_BYTES,
      tagLength: GCM_TAG_BYTES,
    });
    plain = await Crypto.aesDecryptAsync(sealed, key, { additionalData: headerBytes(header) });
  } catch {
    throw new Error(BACKUP_WRONG_PASSWORD);
  }
  return utf8Decode(plain);
}

/**
 * UTF-8 → metin. Hermes'te `TextDecoder` her sürümde bulunmadığı için elle;
 * bozuk dizi U+FFFD olur (doğrulanmış GCM çıktısında beklenmez).
 */
export function utf8Decode(bytes: Uint8Array): string {
  const parts: string[] = [];
  let units: number[] = [];
  const flush = () => {
    parts.push(String.fromCharCode.apply(null, units));
    units = [];
  };
  for (let i = 0; i < bytes.length;) {
    const b0 = bytes[i];
    let cp = 0xfffd;
    let extra = 0;
    if (b0 < 0x80) { cp = b0; } else if (b0 >= 0xc2 && b0 < 0xe0) { cp = b0 & 0x1f; extra = 1; } else if (b0 >= 0xe0 && b0 < 0xf0) { cp = b0 & 0x0f; extra = 2; } else if (b0 >= 0xf0 && b0 < 0xf5) { cp = b0 & 0x07; extra = 3; }
    let valid = b0 < 0x80 || extra > 0;
    for (let k = 1; valid && k <= extra; k++) {
      const b = bytes[i + k];
      if (b === undefined || (b & 0xc0) !== 0x80) valid = false;
      else cp = (cp << 6) | (b & 0x3f);
    }
    if (valid && extra > 0
      && ((extra === 2 && (cp < 0x800 || (cp >= 0xd800 && cp <= 0xdfff)))
        || (extra === 3 && (cp < 0x10000 || cp > 0x10ffff)))) valid = false;
    if (!valid) { cp = 0xfffd; extra = 0; }
    i += 1 + extra;
    if (cp > 0xffff) {
      cp -= 0x10000;
      units.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      units.push(cp);
    }
    if (units.length >= 8192) flush();
  }
  flush();
  return parts.join('');
}
