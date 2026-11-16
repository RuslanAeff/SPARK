import { Alert } from 'react-native';
import { requestConfirmation } from '../components/ConfirmHost';

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
    // UX-09: uygulamanın temalı onay penceresi; kök sunucu yoksa sistem penceresi.
    const themed = requestConfirmation({
      title: t('ai_transfer_title'),
      message: t(`ai_transfer_${kind}`),
      cancelLabel: t('cancel'),
      confirmLabel: t('ai_transfer_send'),
      icon: 'cloud-upload-outline',
    });
    const abort = () => {
      themed?.dismiss();
      finish(false);
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (themed) {
      void themed.result.then(finish);
      return;
    }
    Alert.alert(t('ai_transfer_title'), t(`ai_transfer_${kind}`), [
      { text: t('cancel'), style: 'cancel', onPress: () => finish(false) },
      { text: t('ai_transfer_send'), onPress: () => finish(true) },
    ], { cancelable: true, onDismiss: () => finish(false) });
  });
}
