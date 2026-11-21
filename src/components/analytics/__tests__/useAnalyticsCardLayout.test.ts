// CQ-02: Analiz kart düzeni ekrandan ayrıldı; kuralları ekran olmadan test edilir.
import { act, renderHook } from '@testing-library/react-native';

import { SettingsDao } from '../../../db/settingsDao';
import { SparkToast } from '../../SparkToast';
import {
  ALL_CARDS,
  ANALYTICS_CARD_ORDER_KEY,
  DEFAULT_ACTIVE,
  useAnalyticsCardLayout,
} from '../useAnalyticsCardLayout';

jest.mock('../../../db/settingsDao', () => ({
  SettingsDao: { get: jest.fn(), setJson: jest.fn() },
}));
jest.mock('../../SparkToast', () => ({ SparkToast: { show: jest.fn() } }));
jest.mock('../../../utils/logError', () => ({ logError: jest.fn() }));

const t = (key: string) => key;

beforeEach(() => {
  jest.clearAllMocks();
  (SettingsDao.setJson as jest.Mock).mockResolvedValue(undefined);
});

it('repairs a stored config: drops unknown ids, appends new cards, saves once', async () => {
  (SettingsDao.get as jest.Mock).mockResolvedValue(JSON.stringify({ active: ['vendors', 'ghost'], hidden: ['streak'] }));
  const { result } = await renderHook(() => useAnalyticsCardLayout(t));

  await act(async () => { await result.current!.loadCardConfig(); });

  const { cardOrder, hiddenCards } = result.current!;
  expect(cardOrder[0]).toBe('vendors');
  expect(cardOrder).not.toContain('ghost');
  expect(hiddenCards).toContain('streak');
  expect(new Set([...cardOrder, ...hiddenCards]).size).toBe(ALL_CARDS.length);
  expect(SettingsDao.setJson).toHaveBeenCalledTimes(1);
  expect(SettingsDao.setJson).toHaveBeenCalledWith(ANALYTICS_CARD_ORDER_KEY, { active: cardOrder, hidden: hiddenCards });

  // İkinci çağrı veritabanını yeniden okumaz.
  await act(async () => { await result.current!.loadCardConfig(); });
  expect(SettingsDao.get).toHaveBeenCalledTimes(1);
});

it('refuses to confirm an edit with no active card and keeps editing', async () => {
  (SettingsDao.get as jest.Mock).mockResolvedValue(null);
  const { result } = await renderHook(() => useAnalyticsCardLayout(t));

  await act(async () => { await result.current!.handleCardEditingToggle(); });
  expect(result.current!.isEditing).toBe(true);
  await act(async () => { result.current!.removeAllCards(); });
  await act(async () => { await result.current!.handleCardEditingToggle(); });

  expect(result.current!.isEditing).toBe(true);
  expect(SparkToast.show).toHaveBeenCalledWith('analytics_card_selection_required_title', 'warning', expect.any(String));
  expect(SettingsDao.setJson).not.toHaveBeenCalled();
});

it('saves a confirmed edit and restores it after a discarded draft', async () => {
  const { result } = await renderHook(() => useAnalyticsCardLayout(t));

  await act(async () => { await result.current!.handleCardEditingToggle(); });
  await act(async () => { result.current!.moveCardBy(DEFAULT_ACTIVE[1], -1); });
  await act(async () => { await result.current!.handleCardEditingToggle(); });
  const saved = result.current!.cardOrder;
  expect(saved.slice(0, 2)).toEqual([DEFAULT_ACTIVE[1], DEFAULT_ACTIVE[0]]);
  expect(result.current!.isEditing).toBe(false);

  await act(async () => { await result.current!.handleCardEditingToggle(); });
  await act(async () => { result.current!.removeAllCards(); });
  await act(async () => { result.current!.discardCardDraft(); });

  expect(result.current!.cardOrder).toEqual(saved);
  expect(result.current!.isEditing).toBe(false);
});
