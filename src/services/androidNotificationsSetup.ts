import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

/**
 * Android 8+: en az bir bildirim kanalı tanımlanmalı; aksi halde Ayarlar’da bildirim
 * satırı “engelli” ve anahtar pasif görünebiliyor.
 * Android 13+ (API 33): POST_NOTIFICATIONS çalışma zamanı izni manifest + istek gerektirir.
 *
 * Expo Go (SDK 53+, Android): expo-notifications modülü yüklenirken push tarafı devre dışı
 * olduğu için hata fırlatılıyor — bu yüzden Expo Go’da paketi hiç import etmiyoruz.
 * APK / development build’de dinamik import kullanılır.
 */
export async function ensureAndroidNotificationSetup(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (isRunningInExpoGo()) return;

  const Notifications = await import('expo-notifications');

  await Notifications.setNotificationChannelAsync('default', {
    name: 'S.P.A.R.K',
    importance: Notifications.AndroidImportance.DEFAULT,
  });

  if (typeof Platform.Version === 'number' && Platform.Version >= 33) {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  }
}
