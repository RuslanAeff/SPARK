// S.P.A.R.K. — Global refresh: fiş / işlem kaydı sonrası veriyi geçersiz kıl.
// Yalnızca odaktaki ağır ekranlar doğrudan yenilenir; gizli sekmeler bir sonraki
// focus'ta kendi useFocusEffect'leriyle güncellenir. Böylece tek bir kayıt onlarca
// eşzamanlı sorgu ve render başlatmaz.
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

type RefreshActions = Pick<RefreshContextType, 'triggerRefresh' | 'subscribe'>;

const RefreshActionsContext = createContext<RefreshActions | null>(null);
const RefreshKeyContext = createContext(0);

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
  const actions = useMemo(
    () => ({ triggerRefresh, subscribe }),
    [triggerRefresh, subscribe],
  );

  return (
    <RefreshActionsContext.Provider value={actions}>
      <RefreshKeyContext.Provider value={refreshKey}>
        {children}
      </RefreshKeyContext.Provider>
    </RefreshActionsContext.Provider>
  );
}

export function useRefresh() {
  const refreshKey = useContext(RefreshKeyContext);
  const actions = useRefreshActions();
  return { refreshKey, ...actions };
}

/** refreshKey değişiminde yeniden render gerektirmeyen komut/listener kanalı. */
export function useRefreshActions(): RefreshActions {
  return (
    useContext(RefreshActionsContext) ?? {
      triggerRefresh: () => {},
      subscribe: () => () => {},
    }
  );
}

/** Fiş / manuel işlem kaydı sonrası yalnız etkin ekranı anında yeniler. */
export function useExpenseDataRefresh(onRefresh: () => void, enabled = true) {
  const { subscribe } = useRefreshActions();
  const ref = useRef(onRefresh);
  ref.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;
    const run = () => ref.current();
    return subscribe(run);
  }, [enabled, subscribe]);
}
