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
  acquire: (owner: number) => void;
  release: (owner: number) => void;
}

const TabSwipeContext = createContext<TabSwipeRegistry>({
  swipeEnabled: true,
  acquire: () => undefined,
  release: () => undefined,
});

export function TabSwipeProvider({ children }: React.PropsWithChildren) {
  const ownersRef = useRef(new Set<number>());
  const [swipeEnabled, setSwipeEnabled] = useState(true);

  const acquire = useCallback((owner: number) => {
    ownersRef.current.add(owner);
    setSwipeEnabled(false);
  }, []);
  const release = useCallback((owner: number) => {
    ownersRef.current.delete(owner);
    setSwipeEnabled(ownersRef.current.size === 0);
  }, []);

  const value = useMemo(() => ({ swipeEnabled, acquire, release }), [swipeEnabled, acquire, release]);
  return <TabSwipeContext.Provider value={value}>{children}</TabSwipeContext.Provider>;
}

let nextOwnerId = 1;

export function useTabSwipe() {
  const { swipeEnabled, acquire, release } = useContext(TabSwipeContext);
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

  return { swipeEnabled, setNestedHorizontalGestureActive };
}
