import { Alert } from 'react-native';

/** Each request needs a fresh affirmative action; dismiss/back/abort denies it. */
export function confirmAiTransfer(
  t: (key: string) => string,
  kind: 'receipt' | 'products',
  signal?: AbortSignal,
): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise(resolve => {
    let settled = false;
    const finish = (allowed: boolean) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      resolve(allowed && !signal?.aborted);
    };
    const abort = () => finish(false);
    signal?.addEventListener('abort', abort, { once: true });
    Alert.alert(t('ai_transfer_title'), t(`ai_transfer_${kind}`), [
      { text: t('cancel'), style: 'cancel', onPress: () => finish(false) },
      { text: t('ai_transfer_send'), onPress: () => finish(true) },
    ], { cancelable: true, onDismiss: () => finish(false) });
  });
}
