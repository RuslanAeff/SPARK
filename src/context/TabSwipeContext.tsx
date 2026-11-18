// S.P.A.R.K. — Sekme kaydırma kilidi (UI denetimi FN-05)
//
// İç içe yatay hareket (grafik sayfalayıcı, kart karuseli, Analiz düzenleme
// modu) sürerken alt sekmeler arası kaydırma kilitlenir. Eskiden kilit tek bir
// boolean'dı: bir bileşenin `false` göndermesi, başka bir bileşenin hâlâ
// tuttuğu kilidi de açıyordu (ör. düzenleme modu açıkken bir kartın unmount
// temizliği). Artık her `useTabSwipe()` çağıran kendi sahipliğini taşır;
// kaydırma ancak bütün sahipler bıraktığında açılır. Bileşen unmount olunca
// kendi kilidi otomatik bırakılır.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

interface TabSwipeRegistry {
  swipeEnabled: boolean;
  /** true iken sekmeler arası geçiş (kaydırma ve alt menü dokunuşu) kapalı. */
  navigationLocked: boolean;
  acquire: (owner: number) => void;
  release: (owner: number) => void;
  lockNavigation: (owner: number) => void;
  unlockNavigation: (owner: number) => void;
}

const TabSwipeContext = createContext<TabSwipeRegistry>({
  swipeEnabled: true,
  navigationLocked: false,
  acquire: () => undefined,
  release: () => undefined,
  lockNavigation: () => undefined,
  unlockNavigation: () => undefined,
});

export function TabSwipeProvider({ children }: React.PropsWithChildren) {
  const ownersRef = useRef(new Set<number>());
  const navOwnersRef = useRef(new Set<number>());
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const [navigationLocked, setNavigationLocked] = useState(false);

  const acquire = useCallback((owner: number) => {
    ownersRef.current.add(owner);
    setSwipeEnabled(false);
  }, []);
  const release = useCallback((owner: number) => {
    ownersRef.current.delete(owner);
    setSwipeEnabled(ownersRef.current.size === 0);
  }, []);

  const lockNavigation = useCallback((owner: number) => {
    navOwnersRef.current.add(owner);
    setNavigationLocked(true);
  }, []);
  const unlockNavigation = useCallback((owner: number) => {
    navOwnersRef.current.delete(owner);
    setNavigationLocked(navOwnersRef.current.size > 0);
  }, []);

  const value = useMemo(
    () => ({
      // Gezinme kilidi kaydırmayı da kapatır.
      swipeEnabled: swipeEnabled && !navigationLocked,
      navigationLocked,
      acquire,
      release,
      lockNavigation,
      unlockNavigation,
    }),
    [swipeEnabled, navigationLocked, acquire, release, lockNavigation, unlockNavigation],
  );
  return <TabSwipeContext.Provider value={value}>{children}</TabSwipeContext.Provider>;
}

let nextOwnerId = 1;

export function useTabSwipe() {
  const { swipeEnabled, navigationLocked, acquire, release } = useContext(TabSwipeContext);
  const ownerRef = useRef(0);
  if (ownerRef.current === 0) ownerRef.current = nextOwnerId++;

  const setNestedHorizontalGestureActive = useCallback((active: boolean) => {
    if (active) acquire(ownerRef.current);
    else release(ownerRef.current);
  }, [acquire, release]);

  // Bileşen kaybolurken tuttuğu kilit asılı kalmasın.
  useEffect(() => {
    const owner = ownerRef.current;
    return () => release(owner);
  }, [release]);

  return { swipeEnabled, navigationLocked, setNestedHorizontalGestureActive };
}

let nextNavOwnerId = 1;

/**
 * `active` iken sekmeler arası geçişi (yana kaydırma ve alt menü dokunuşu)
 * kilitler; ör. İşlemler'de çoklu seçim sürerken kullanıcı önce silmeli veya
 * iptal etmelidir (ürün sahibi kararı, 18 Kasım 2026). Unmount kilidi bırakır.
 */
export function useTabNavigationLock(active: boolean): void {
  const { lockNavigation, unlockNavigation } = useContext(TabSwipeContext);
  const ownerRef = useRef(0);
  if (ownerRef.current === 0) ownerRef.current = nextNavOwnerId++;
  useEffect(() => {
    const owner = ownerRef.current;
    if (active) lockNavigation(owner);
    else unlockNavigation(owner);
    return () => unlockNavigation(owner);
  }, [active, lockNavigation, unlockNavigation]);
}
