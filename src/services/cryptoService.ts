// S.P.A.R.K. — Crypto Service (Settings encryption helper)
import * as Crypto from 'expo-crypto';

export async function generateHash(data: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}
