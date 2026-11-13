// S.P.A.R.K. — Yedek parolası için native PBKDF2-HMAC-SHA256 (SEC-01, ADR-018)
//
// Saf JS anahtar türetme telefonda ~23 sn sürdüğü için (13 Kasım cihaz ölçümü)
// iş uygulamanın kendi native modülüne (spark-bounded-file) taşındı: Android'de
// platform HmacSHA256, iOS'ta CommonCrypto. JS'e yavaş geri düşüş YOKTUR; modül
// eskiyse şifreleme kullanılamaz ve kullanıcıya "uygulamayı güncelle" denir.
import { requireOptionalNativeModule } from 'expo-modules-core';

export const BACKUP_ENCRYPTION_UNAVAILABLE = 'BACKUP_ENCRYPTION_UNAVAILABLE';

type SparkKdfModule = {
  pbkdf2Sha256?: (password: string, saltHex: string, iterations: number, keyLength: number) => Promise<string>;
};

export async function pbkdf2Sha256(
  password: string,
  saltHex: string,
  iterations: number,
  keyLength: number,
): Promise<Uint8Array> {
  const native = requireOptionalNativeModule<SparkKdfModule>('SparkBoundedFile');
  if (typeof native?.pbkdf2Sha256 !== 'function') throw new Error(BACKUP_ENCRYPTION_UNAVAILABLE);
  const hex = await native.pbkdf2Sha256(password, saltHex, iterations, keyLength);
  if (typeof hex !== 'string' || hex.length !== keyLength * 2 || !/^[0-9a-f]+$/.test(hex)) {
    throw new Error(BACKUP_ENCRYPTION_UNAVAILABLE);
  }
  return hexToBytes(hex);
}

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}
