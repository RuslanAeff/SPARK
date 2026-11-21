// S.P.A.R.K. — Analiz kart düzeni (UI denetimi CQ-02)
//
// Analiz ekranı tek bileşende kart sırası, gizli kartlar, düzenleme modu,
// sürükle-sırala ve kalıcılığı da taşıyordu. Bu mantık davranış değiştirmeden
// buraya taşındı; ekran yalnız çizer ve odak/kaydırma kilidini yönetir.
//
// Kurallar (değişmedi):
//   • Düzenleme yalnız onaylanınca kalıcıdır; en az bir aktif kart gerekir.
//   • Ekrandan ayrılmak onay değildir: `discardCardDraft` son kaydedilen
//     yapılandırmayı geri yükler.
//   • Eski sürümden gelen kayıtta bilinmeyen kartlar ayıklanır, yeni kartlar
//     eklenir ve onarılmış yapılandırma geri yazılır.
import { useCallback, useRef, useState } from 'react';
import type { ScrollView } from 'react-native';

import { SparkToast } from '../SparkToast';
import { SettingsDao } from '../../db/settingsDao';
import { SETTINGS_KEYS } from '../../db/settingsKeys';
import { logError } from '../../utils/logError';
import {
  type AnalyticsCardConfig,
  buildAllCardsHiddenConfig,
  hasActiveAnalyticsCard,
  resolveAnalyticsCardEditExit,
} from '../../utils/analyticsCardConfig';

const CARD_GAP = 8;
export const ANALYTICS_CARD_ORDER_KEY = SETTINGS_KEYS.analyticsCardOrder;

export const ALL_CARDS: { id: string; icon: string; labelKey: string }[] = [
  { id: 'chart',           icon: 'chart-bar',          labelKey: 'card_chart' },
  { id: 'projection',      icon: 'crystal-ball',       labelKey: 'card_projection' },
  { id: 'spending_change', icon: 'chart-waterfall', labelKey: 'spending_change_title' },
  { id: 'monthly_compare', icon: 'swap-horizontal',    labelKey: 'card_monthly_compare' },
  { id: 'goal',            icon: 'flag-checkered',     labelKey: 'card_goal' },
  { id: 'limits_health',   icon: 'gauge',              labelKey: 'card_limits_health' },
  { id: 'subscriptions',   icon: 'sync-circle',        labelKey: 'card_subscriptions' },
  { id: 'silent_spend',    icon: 'water-outline',      labelKey: 'card_silent_spend' },
  { id: 'personal_inflation', icon: 'basket-outline',  labelKey: 'card_personal_inflation' },
  { id: 'categories',      icon: 'shape-outline',      labelKey: 'card_categories' },
  { id: 'streak',          icon: 'fire',               labelKey: 'card_streak' },
  { id: 'donut',           icon: 'chart-donut',        labelKey: 'card_donut' },
  { id: 'heatmap',         icon: 'calendar-month',     labelKey: 'card_heatmap' },
  { id: 'top_tx',          icon: 'podium-gold',        labelKey: 'card_top_tx' },
  { id: 'price_watch',     icon: 'tag-arrow-up',       labelKey: 'card_price_watch' },
  { id: 'vendors',         icon: 'store-outline',      labelKey: 'card_vendors' },
];

export const DEFAULT_ACTIVE = ['chart', 'projection', 'monthly_compare', 'spending_change', 'personal_inflation', 'goal', 'limits_health', 'subscriptions', 'silent_spend', 'categories', 'vendors', 'top_tx'];
export const DEFAULT_HIDDEN = ALL_CARDS.map(card => card.id).filter(id => !DEFAULT_ACTIVE.includes(id));

interface DragInfo {
  id: string;
  originalIdx: number;
  targetIdx: number;
  initialScroll: number;
}

async function saveCardConfig(active: string[], hidden: string[]): Promise<boolean> {
  if (!hasActiveAnalyticsCard(active)) return false;
  try {
    await SettingsDao.setJson(ANALYTICS_CARD_ORDER_KEY, { active, hidden });
    return true;
  } catch (e) {
    logError('Error saving card config', e);
    return false;
  }
}

export function useAnalyticsCardLayout(t: (key: string) => string) {
  const [isEditing, setIsEditing] = useState(false);
  const [cardOrder, setCardOrder] = useState<string[]>(DEFAULT_ACTIVE);
  const [hiddenCards, setHiddenCards] = useState<string[]>(DEFAULT_HIDDEN);
  const committedCardConfigRef = useRef<AnalyticsCardConfig>({
    active: [...DEFAULT_ACTIVE],
    hidden: [...DEFAULT_HIDDEN],
  });
  const configLoaded = useRef(false);
  const heightsRef = useRef<{ [key: string]: number }>({});
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);

  const [activeDrag, setActiveDrag] = useState<DragInfo | null>(null);
  const dragRef = useRef<DragInfo | null>(null);

  const handleLayout = (id: string, height: number) => {
    heightsRef.current[id] = height;
  };

  function getCardPositions() {
    const positions: { id: string; center: number }[] = [];
    let cumTop = 0;
    for (const cid of cardOrder) {
      const h = heightsRef.current[cid] || 150;
      positions.push({ id: cid, center: cumTop + h / 2 });
      cumTop += h + CARD_GAP;
    }
    return positions;
  }

  function getShiftOffset(cardId: string, cardIndex: number): number {
    if (!activeDrag || activeDrag.id === cardId) return 0;
    const { originalIdx, targetIdx } = activeDrag;
    const draggedH = heightsRef.current[activeDrag.id] || 150;

    if (targetIdx > originalIdx && cardIndex > originalIdx && cardIndex <= targetIdx) {
      return -(draggedH + CARD_GAP);
    }
    if (targetIdx < originalIdx && cardIndex >= targetIdx && cardIndex < originalIdx) {
      return draggedH + CARD_GAP;
    }
    return 0;
  }

  function handleDragStart(id: string) {
    const idx = cardOrder.indexOf(id);
    const info: DragInfo = { id, originalIdx: idx, targetIdx: idx, initialScroll: scrollOffsetRef.current };
    dragRef.current = info;
    setActiveDrag(info);
  }

  function handleDragMove(id: string, dy: number) {
    const drag = dragRef.current;
    if (!drag || drag.id !== id) return;

    const scrollDelta = scrollOffsetRef.current - drag.initialScroll;
    const adjustedDy = dy + scrollDelta;

    const positions = getCardPositions();
    const virtualCenter = positions[drag.originalIdx].center + adjustedDy;

    let rank = 0;
    for (let i = 0; i < positions.length; i++) {
      if (i === drag.originalIdx) continue;
      if (virtualCenter > positions[i].center) rank++;
    }

    if (rank !== drag.targetIdx) {
      drag.targetIdx = rank;
      setActiveDrag({ ...drag });
    }
  }

  function handleDragEnd() {
    const drag = dragRef.current;
    if (!drag) { setActiveDrag(null); return; }

    const { originalIdx, targetIdx } = drag;
    if (targetIdx !== originalIdx) {
      setCardOrder(prev => {
        const arr = [...prev];
        const [removed] = arr.splice(originalIdx, 1);
        arr.splice(targetIdx, 0, removed);
        return arr;
      });
    }

    dragRef.current = null;
    setActiveDrag(null);
  }

  // A11Y-03: ekran okuyucuyla kartı bir sıra yukarı/aşağı taşı.
  function moveCardBy(id: string, delta: -1 | 1) {
    setCardOrder(prev => {
      const from = prev.indexOf(id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const arr = [...prev];
      [arr[from], arr[to]] = [arr[to], arr[from]];
      return arr;
    });
  }

  function removeCard(id: string) {
    setCardOrder(prev => {
      const next = prev.filter(c => c !== id);
      setHiddenCards(h => {
        return [...h, id];
      });
      return next;
    });
  }

  function addCard(id: string) {
    setHiddenCards(prev => {
      const nh = prev.filter(c => c !== id);
      setCardOrder(co => {
        return [...co, id];
      });
      return nh;
    });
  }

  function removeAllCards() {
    const next = buildAllCardsHiddenConfig(ALL_CARDS.map(card => card.id));
    dragRef.current = null;
    setActiveDrag(null);
    setCardOrder(next.active);
    setHiddenCards(next.hidden);
  }

  async function handleCardEditingToggle() {
    if (!isEditing) {
      const committed = committedCardConfigRef.current;
      setCardOrder([...committed.active]);
      setHiddenCards([...committed.hidden]);
      setIsEditing(true);
      return;
    }
    const confirmed = resolveAnalyticsCardEditExit(
      { active: cardOrder, hidden: hiddenCards },
      committedCardConfigRef.current,
      'confirm',
    );
    if (!confirmed) {
      SparkToast.show(
        t('analytics_card_selection_required_title'),
        'warning',
        t('analytics_card_selection_required_desc'),
      );
      return;
    }
    const saved = await saveCardConfig(confirmed.active, confirmed.hidden);
    if (!saved) {
      SparkToast.show(t('error_saving_data'), 'error');
      return;
    }
    committedCardConfigRef.current = confirmed;
    setCardOrder(confirmed.active);
    setHiddenCards(confirmed.hidden);
    setIsEditing(false);
  }


  const loadCardConfig = useCallback(async () => {
    if (configLoaded.current) return;
    try {
      // CQ-03: ekran ham SQL yazmaz; ayar DAO'su üzerinden okunur.
      const raw = await SettingsDao.get(ANALYTICS_CARD_ORDER_KEY);
      if (raw != null) {
        const parsed = JSON.parse(raw);
        // Kart düzenleme yalnız onaylandığında kalıcıdır. Eski/bozuk bir sürüm
        // boş aktif liste yazmış olsa bile bu değer geçerli tercih sayılmaz.
        if (Array.isArray(parsed.active)) {
          // Migration: Kayıtlı konfig eski sürümden geliyor olabilir; ALL_CARDS'a
          // sonradan eklenmiş kartlar ne aktif ne de gizli listede görünmüyor.
          // Bilinmeyenleri tara: DEFAULT_ACTIVE'daysa aktife sondan ekle, değilse
          // gizli "kullanılabilir" listesine ekle. Geçerli/güncel kartları DB'ye
          // yaz ki bir sonraki açılışta migration tekrar çalışmasın.
          const validIds = new Set(ALL_CARDS.map(c => c.id));
          const savedActive: string[] = parsed.active.filter((id: string) => validIds.has(id));
          const parsedHidden: unknown[] = Array.isArray(parsed.hidden) ? parsed.hidden : [];
          const savedHidden: string[] = parsedHidden.filter(
            (id): id is string => typeof id === 'string' && validIds.has(id),
          );
          const known = new Set([...savedActive, ...savedHidden]);
          const missing = ALL_CARDS.map(c => c.id).filter(id => !known.has(id));
          const newActive = [...savedActive];
          const newHidden = [...savedHidden];
          for (const id of missing) {
            if (DEFAULT_ACTIVE.includes(id)) newActive.push(id);
            else newHidden.push(id);
          }
          // Eski/yarım bir sürüm boş aktif liste kaydetmişse boş Analiz
          // sayfası yerine en temel kartla güvenli biçimde onar.
          if (newActive.length === 0) {
            const fallbackId = DEFAULT_ACTIVE[0];
            newActive.push(fallbackId);
            const fallbackHiddenIndex = newHidden.indexOf(fallbackId);
            if (fallbackHiddenIndex >= 0) newHidden.splice(fallbackHiddenIndex, 1);
          }
          committedCardConfigRef.current = {
            active: [...newActive],
            hidden: [...newHidden],
          };
          setCardOrder(newActive);
          setHiddenCards(newHidden);
          if (
            missing.length > 0 ||
            newActive.length !== parsed.active.length ||
            newHidden.length !== parsedHidden.length
          ) {
            await saveCardConfig(newActive, newHidden);
          }
        }
      }
      configLoaded.current = true;
    } catch { /* use defaults */ }
  }, []);


  const discardCardDraft = useCallback(() => {
    const restored = resolveAnalyticsCardEditExit(
      { active: [], hidden: [] },
      committedCardConfigRef.current,
      'discard',
    );
    if (restored) {
      setCardOrder(restored.active);
      setHiddenCards(restored.hidden);
    }
    setIsEditing(false);
  }, []);

  return {
    cardOrder,
    hiddenCards,
    isEditing,
    activeDrag,
    scrollRef,
    scrollOffsetRef,
    handleLayout,
    getShiftOffset,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    moveCardBy,
    removeCard,
    addCard,
    removeAllCards,
    handleCardEditingToggle,
    loadCardConfig,
    discardCardDraft,
  };
}
