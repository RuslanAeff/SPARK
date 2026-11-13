// SEC-01 (ürün kararı A): isteğe bağlı parolalı yedek şifrelemesi.
jest.mock('expo-crypto', () => require('../../test-utils/expoCryptoAesMock').expoCryptoAesMock);
jest.mock('../nativeKdf', () => {
  const actual = jest.requireActual('../nativeKdf');
  const { nativeKdfMock } = require('../../test-utils/expoCryptoAesMock');
  return {
    ...actual,
    pbkdf2Sha256: async (...args: [string, string, number, number]) => new Uint8Array(await nativeKdfMock.pbkdf2Sha256(...args)),
  };
});

import {
  BACKUP_PASSWORD_TOO_SHORT,
  BACKUP_WRONG_PASSWORD,
  decryptBackupEnvelope,
  encryptBackupJson,
  isEncryptedBackupEnvelope,
  utf8Decode,
} from '../backupEncryption';

const JSON_TEXT = JSON.stringify({ app: 'S.P.A.R.K.', note: 'Şeker 🍬 Çay – zł', n: 1 });

describe('backupEncryption', () => {
  it('doğru parolayla aynı metni geri verir; dosyada düz metin yoktur', async () => {
    const envelopeText = await encryptBackupJson(JSON_TEXT, 'güçlü-parola-1');
    const envelope = JSON.parse(envelopeText);
    expect(isEncryptedBackupEnvelope(envelope)).toBe(true);
    expect(envelope).toMatchObject({
      format: 'spark-encrypted-backup', envelope_version: 1, cipher: 'aes-256-gcm',
      kdf: { name: 'pbkdf2-sha256', iterations: 600000 },
    });
    expect(envelopeText).not.toContain('Şeker');
    expect(envelopeText).not.toContain('note');
    expect(await decryptBackupEnvelope(envelope, 'güçlü-parola-1')).toBe(JSON_TEXT);
  });

  it('aynı içerik iki kez şifrelenince farklı tuz ve şifreli metin üretir', async () => {
    const a = JSON.parse(await encryptBackupJson(JSON_TEXT, 'parola-12345'));
    const b = JSON.parse(await encryptBackupJson(JSON_TEXT, 'parola-12345'));
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.data).not.toBe(b.data);
  });

  it('yanlış parola ve değiştirilmiş başlık/veri açılmaz', async () => {
    const envelope = JSON.parse(await encryptBackupJson(JSON_TEXT, 'parola-12345'));
    await expect(decryptBackupEnvelope(envelope, 'parola-12346')).rejects.toThrow(BACKUP_WRONG_PASSWORD);
    await expect(decryptBackupEnvelope(envelope, '')).rejects.toThrow(BACKUP_WRONG_PASSWORD);
    // Başlık AAD'ye bağlıdır: tur sayısı değiştirilirse anahtar ve AAD tutmaz.
    await expect(decryptBackupEnvelope({ ...envelope, kdf: { ...envelope.kdf, iterations: 600001 } }, 'parola-12345'))
      .rejects.toThrow(BACKUP_WRONG_PASSWORD);
    const bytes = Buffer.from(envelope.data, 'base64');
    bytes[20] ^= 1;
    await expect(decryptBackupEnvelope({ ...envelope, data: bytes.toString('base64') }, 'parola-12345'))
      .rejects.toThrow(BACKUP_WRONG_PASSWORD);
  });

  it('kısa parolayı reddeder', async () => {
    await expect(encryptBackupJson(JSON_TEXT, '1234567')).rejects.toThrow(BACKUP_PASSWORD_TOO_SHORT);
  });

  it('bozuk veya aşırı parametreli zarfı parola türetmeden reddeder', async () => {
    const envelope = JSON.parse(await encryptBackupJson(JSON_TEXT, 'parola-12345'));
    for (const broken of [
      { ...envelope, kdf: { ...envelope.kdf, iterations: 50_000_000 } },
      { ...envelope, kdf: { ...envelope.kdf, salt: 'zz' } },
      { ...envelope, cipher: 'aes-128-cbc' },
      { ...envelope, data: 'AAAA' },
      { ...envelope, app: 'X' },
    ]) {
      await expect(decryptBackupEnvelope(broken, 'parola-12345')).rejects.toThrow('INVALID_FORMAT');
    }
    await expect(decryptBackupEnvelope({ ...envelope, envelope_version: 2 }, 'parola-12345'))
      .rejects.toThrow('UNSUPPORTED_VERSION');
    // Geliştirme sırasında üretilmiş eski scrypt dosyası: bozuk değil, desteklenmiyor.
    await expect(decryptBackupEnvelope(
      { ...envelope, kdf: { name: 'scrypt', log_n: 15, r: 8, p: 1, salt: envelope.kdf.salt } }, 'parola-12345',
    )).rejects.toThrow('UNSUPPORTED_VERSION');
  });

  it('utf8Decode çok baytlı karakterleri ve büyük girdiyi doğru çözer', () => {
    const text = 'aÇğİş€𝄞' + 'x'.repeat(20000) + '🍬';
    expect(utf8Decode(new Uint8Array(Buffer.from(text, 'utf8')))).toBe(text);
    expect(utf8Decode(new Uint8Array([0xff, 0x41]))).toBe('�A');
  });

});

describe('nativeKdf', () => {
  it('eski APK\'da native fonksiyon yoksa yavaş JS\'e düşmez, açık hata verir', async () => {
    jest.resetModules();
    jest.doMock('expo-modules-core', () => ({ requireOptionalNativeModule: () => ({ readUtf8: jest.fn() }) }));
    const { pbkdf2Sha256, BACKUP_ENCRYPTION_UNAVAILABLE } = jest.requireActual('../nativeKdf');
    await expect(pbkdf2Sha256('parola-12345', '00'.repeat(16), 600000, 32))
      .rejects.toThrow(BACKUP_ENCRYPTION_UNAVAILABLE);
  });

  it('native çıktıyı biçim denetiminden geçirip bayta çevirir', async () => {
    jest.resetModules();
    jest.doMock('expo-modules-core', () => ({
      requireOptionalNativeModule: () => ({ pbkdf2Sha256: async () => 'ab'.repeat(32) }),
    }));
    const { pbkdf2Sha256 } = jest.requireActual('../nativeKdf');
    expect(Array.from(await pbkdf2Sha256('parola-12345', '00'.repeat(16), 600000, 32)))
      .toEqual(new Array(32).fill(0xab));
  });
});
