import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface TabSwipeContextValue {
  swipeEnabled: boolean;
  setNestedHorizontalGestureActive: (active: boolean) => void;
}

const TabSwipeContext = createContext<TabSwipeContextValue>({
  swipeEnabled: true,
  setNestedHorizontalGestureActive: () => undefined,
});

export function TabSwipeProvider({ children }: React.PropsWithChildren) {
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const setNestedHorizontalGestureActive = useCallback((active: boolean) => {
    setSwipeEnabled(!active);
  }, []);
  const value = useMemo(
    () => ({ swipeEnabled, setNestedHorizontalGestureActive }),
    [setNestedHorizontalGestureActive, swipeEnabled],
  );

  return <TabSwipeContext.Provider value={value}>{children}</TabSwipeContext.Provider>;
}

export function useTabSwipe() {
  return useContext(TabSwipeContext);
}
