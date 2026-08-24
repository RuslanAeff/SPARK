const mockManipulateAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockDeleteAsync = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}));

import {
  buildReceiptResizeAction,
  compressImageToBase64,
} from '../imageCompressor';

describe('imageCompressor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockManipulateAsync.mockResolvedValue({ uri: 'file://compressed.jpg' });
    mockReadAsStringAsync.mockResolvedValue('base64-image');
    mockDeleteAsync.mockResolvedValue(undefined);
  });

  it('küçük görüntüyü büyütmez', () => {
    expect(buildReceiptResizeAction(720, 1280)).toEqual([]);
  });

  it('portre fişte en uzun kenarı, yatay fişte genişliği sınırlar', () => {
    expect(buildReceiptResizeAction(1600, 4000)).toEqual([{ resize: { height: 2048 } }]);
    expect(buildReceiptResizeAction(4000, 1600)).toEqual([{ resize: { width: 2048 } }]);
  });

  it('tek kontrollü JPEG dönüşümü yapıp geçici dosyayı temizler', async () => {
    await expect(compressImageToBase64('file://receipt.jpg', {
      width: 1600,
      height: 4000,
    })).resolves.toBe('base64-image');

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      'file://receipt.jpg',
      [{ resize: { height: 2048 } }],
      { compress: 0.82, format: 'jpeg' },
    );
    expect(mockDeleteAsync).toHaveBeenCalledWith('file://compressed.jpg', { idempotent: true });
  });

  it('kullanıcı iptalini sıkıştırma tamamlanmadan iletir', async () => {
    mockManipulateAsync.mockReturnValue(new Promise(() => {}));
    const controller = new AbortController();
    const pending = compressImageToBase64('file://receipt.jpg', {
      width: 1600,
      height: 4000,
      signal: controller.signal,
    });

    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
