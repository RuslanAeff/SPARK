// S.P.A.R.K. — Global refresh: fiş / işlem kaydı sonrası tüm ekranları güncelle
// Not: Tab navigator lazy ise bazı ekranlar unmount olur; refreshKey sadece mount
// olanlara gider. Bu yüzden listener listesi ile her kayıtta doğrudan çağrı yapılır.
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';

interface RefreshContextType {
  refreshKey: number;
  triggerRefresh: () => void;
  /** Kayıt sonrası anında çalışır; unmount olmuş sekme bile tekrar açılınca focus ile yenilenir */
  subscribe: (fn: () => void) => () => void;
}

const RefreshContext = createContext<RefreshContextType | null>(null);

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const listenersRef = useRef(new Set<() => void>());

  const subscribe = useCallback((fn: () => void) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    listenersRef.current.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.warn('[RefreshContext] listener error', e);
      }
    });
  }, []);

  // P7: Provider value memoize — refreshKey değişmediği sürece tüketicilerin
  // context değişikliği algılamasını engeller.
  const value = useMemo(
    () => ({ refreshKey, triggerRefresh, subscribe }),
    [refreshKey, triggerRefresh, subscribe],
  );

  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
}

export function useRefresh() {
  const ctx = useContext(RefreshContext);
  if (!ctx) {
    return {
      refreshKey: 0,
      triggerRefresh: () => {},
      subscribe: () => () => {},
    };
  }
  return ctx;
}

/** Fiş / manuel işlem kaydı sonrası tüm abone ekranları anında yeniler */
export function useExpenseDataRefresh(onRefresh: () => void) {
  const { subscribe } = useRefresh();
  const ref = useRef(onRefresh);
  ref.current = onRefresh;

  useEffect(() => {
    const run = () => ref.current();
    return subscribe(run);
  }, [subscribe]);
}
