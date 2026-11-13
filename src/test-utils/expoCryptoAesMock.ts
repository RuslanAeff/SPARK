// Jest için expo-crypto AES-GCM yerine geçen, Node `crypto` tabanlı sahte.
// Gerçek API'nin biçimini izler: combined = iv(12) || şifreli metin || etiket(16);
// string girdi base64'tür; yanlış anahtar/AAD'de çözme reddedilir.
/* eslint-disable @typescript-eslint/no-var-requires */
const nodeCrypto = require('node:crypto');

type Binary = string | Uint8Array | ArrayBuffer;
const toBuffer = (input: Binary): Buffer => (typeof input === 'string'
  ? Buffer.from(input, 'base64')
  : Buffer.from(input instanceof ArrayBuffer ? new Uint8Array(input) : input));

class AESEncryptionKey {
  constructor(public readonly raw: Buffer) {}
  static async import(bytes: Uint8Array): Promise<AESEncryptionKey> {
    if (![16, 24, 32].includes(bytes.length)) throw new Error('Invalid key size');
    return new AESEncryptionKey(Buffer.from(bytes));
  }
}

class AESSealedData {
  constructor(private readonly buffer: Buffer, private readonly ivLength = 12, private readonly tagLength = 16) {}
  static fromCombined(combined: Binary, config?: { ivLength: number; tagLength: number }): AESSealedData {
    return new AESSealedData(toBuffer(combined), config?.ivLength ?? 12, config?.tagLength ?? 16);
  }
  get parts() {
    return {
      iv: this.buffer.subarray(0, this.ivLength),
      ciphertext: this.buffer.subarray(this.ivLength, this.buffer.length - this.tagLength),
      tag: this.buffer.subarray(this.buffer.length - this.tagLength),
    };
  }
  async combined(encoding: 'bytes' | 'base64' = 'bytes'): Promise<string | Uint8Array> {
    return encoding === 'base64' ? this.buffer.toString('base64') : new Uint8Array(this.buffer);
  }
}

export const expoCryptoAesMock = {
  /** Testler son şifreleme çağrısını gözlemleyebilsin. */
  calls: { encrypt: 0, decrypt: 0 },
  AESEncryptionKey,
  AESSealedData,
  getRandomBytesAsync: async (n: number) => new Uint8Array(nodeCrypto.randomBytes(n)),
  getRandomBytes: (n: number) => new Uint8Array(nodeCrypto.randomBytes(n)),
  randomUUID: () => nodeCrypto.randomUUID(),
  async aesEncryptAsync(plaintext: Binary, key: AESEncryptionKey, options: { additionalData?: Binary } = {}) {
    expoCryptoAesMock.calls.encrypt += 1;
    const iv = nodeCrypto.randomBytes(12);
    const cipher = nodeCrypto.createCipheriv(`aes-${key.raw.length * 8}-gcm`, key.raw, iv);
    if (options.additionalData) cipher.setAAD(toBuffer(options.additionalData));
    const ct = Buffer.concat([cipher.update(toBuffer(plaintext)), cipher.final()]);
    return new AESSealedData(Buffer.concat([iv, ct, cipher.getAuthTag()]));
  },
  async aesDecryptAsync(sealed: AESSealedData, key: AESEncryptionKey, options: { additionalData?: Binary } = {}) {
    expoCryptoAesMock.calls.decrypt += 1;
    const { iv, ciphertext, tag } = sealed.parts;
    const decipher = nodeCrypto.createDecipheriv(`aes-${key.raw.length * 8}-gcm`, key.raw, iv);
    if (options.additionalData) decipher.setAAD(toBuffer(options.additionalData));
    decipher.setAuthTag(tag);
    return new Uint8Array(Buffer.concat([decipher.update(ciphertext), decipher.final()]));
  },
};

/** Jest için native PBKDF2 (spark-bounded-file) yerine Node'un aynı algoritması. */
export const nativeKdfMock = {
  calls: 0,
  async pbkdf2Sha256(password: string, saltHex: string, iterations: number, keyLength: number) {
    nativeKdfMock.calls += 1;
    if (!password || iterations < 100_000 || iterations > 2_000_000 || keyLength !== 32
      || !/^[0-9a-f]{32,128}$/.test(saltHex)) throw new Error('INVALID_FORMAT');
    return nodeCrypto.pbkdf2Sync(Buffer.from(password, 'utf8'), Buffer.from(saltHex, 'hex'), iterations, keyLength, 'sha256');
  },
};
