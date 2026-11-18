// S.P.A.R.K. — Klavye yardımcıları (UI denetimi UX-04)
//
// Android'in kenardan kenara modunda (SDK 55) saydam sistem çubuklu modal
// pencereler ve ekranlar klavye açılınca kendiliğinden yeniden boyutlanmıyor:
// borç/gelir/katkı sayfalarında ve bütçe ekranında klavye alanları ve "Kaydet"
// düğmesini örtüyordu (ürün sahibi cihazda doğruladı, 18 Kasım 2026).
//
//   • useKeyboardHeight: açık klavyenin yüksekliği (kapalıyken 0).
//   • useKeepFocusedInputVisible: klavye açılınca verilen ScrollView içindeki
//     odaklı alanı klavyenin hemen üstüne kaydırır.
import { useEffect, useState, type RefObject } from 'react';
import { Keyboard, Platform, TextInput, findNodeHandle, type ScrollView } from 'react-native';

const SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(SHOW_EVENT, (event) => setHeight(event.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(HIDE_EVENT, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/** Klavye açıldıktan sonra odaklı alanı `scrollRef` içinde görünür yapar. */
export function useKeepFocusedInputVisible(
  scrollRef: RefObject<ScrollView | null>,
  extraOffset = 24,
): void {
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      // Düzen (yukarı kalkan sayfa / küçülen alan) bir kare sonra oturur.
      requestAnimationFrame(() => {
        const focused = TextInput.State.currentlyFocusedInput?.();
        const handle = focused ? findNodeHandle(focused as never) : null;
        const scroll = scrollRef.current as unknown as {
          scrollResponderScrollNativeHandleToKeyboard?: (node: number, offset: number, preventNegative: boolean) => void;
        } | null;
        if (handle != null) scroll?.scrollResponderScrollNativeHandleToKeyboard?.(handle, extraOffset, true);
      });
    });
    return () => sub.remove();
  }, [scrollRef, extraOffset]);
}
