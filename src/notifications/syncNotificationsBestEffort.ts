/**
 * Bildirim planlama finansal/domain yazısının ikincil yan etkisidir. Kaynak
 * kayıt commit edildikten sonra native senkronizasyon reddederse kullanıcıya
 * ana işlem başarısızmış gibi davranmak aynı kaydın ikinci kez girilmesine yol
 * açabilir. Hata provider'ın sonraki refresh/resume uzlaştırmasına bırakılır.
 */
export async function syncNotificationsBestEffort(
  sync: () => Promise<void>,
  source: string,
): Promise<void> {
  try {
    await sync();
  } catch (error) {
    if (__DEV__) console.warn(`[notifications] ${source} sync failed`, error);
  }
}
