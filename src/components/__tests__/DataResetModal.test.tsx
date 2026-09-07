// react-native-reanimated → __mocks__/react-native-reanimated.js (otomatik)
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import DataResetModal, { HOLD_TO_CONFIRM_MS } from '../DataResetModal';
import type { UserDataSummary } from '../../services/dataReset';

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ language: 'tr', t: (key: string) => key }),
}));
jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemeRevision: () => 0,
}));
jest.mock('../SparkToast', () => ({ SparkToastContainer: () => null }));

const summary: UserDataSummary = {
  expenses: 472,
  items: 862,
  vendors: 28,
  budgets: 10,
  debts: 2,
  incomes: 5,
  paymentPlans: 1,
  products: 0,
  customCategories: 0,
  categoryLimits: 0,
  goals: 0,
  total: 518,
};

const noop = () => {};

/**
 * Zamanı ilerletir. `act` MUTLAKA await edilir: edilmezse act kapsamları iç
 * içe geçer ve aynı dosyadaki sonraki testlerin render'ı bozulur.
 */
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('DataResetModal basılı tutma kapısı', () => {

  it('tek dokunuş silmez — parmak süreyi doldurmadan kalkarsa hiçbir şey olmaz', async () => {
    jest.useFakeTimers();
    try {
      const onConfirm = jest.fn();
      const screen = await render(
        <DataResetModal visible summary={summary} onCancel={noop} onConfirm={onConfirm} />,
      );
      const button = screen.getByTestId('data-reset-confirm');

      await fireEvent(button, 'pressIn');
      await advance(HOLD_TO_CONFIRM_MS - 200);
      await fireEvent(button, 'pressOut');
      await advance(HOLD_TO_CONFIRM_MS);

      expect(onConfirm).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('süre dolana kadar basılı tutulursa siler', async () => {
    jest.useFakeTimers();
    try {
      const onConfirm = jest.fn();
      const screen = await render(
        <DataResetModal visible summary={summary} onCancel={noop} onConfirm={onConfirm} />,
      );

      await fireEvent(screen.getByTestId('data-reset-confirm'), 'pressIn');
      await advance(HOLD_TO_CONFIRM_MS);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('basış sürerken düğme metni durumu bildirir', async () => {
    jest.useFakeTimers();
    try {
      const screen = await render(
        <DataResetModal visible summary={summary} onCancel={noop} onConfirm={noop} />,
      );

      expect(screen.getByText('data_reset_confirm_cta')).toBeTruthy();
      await fireEvent(screen.getByTestId('data-reset-confirm'), 'pressIn');
      expect(screen.getByText('data_reset_hold_active')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('pencere kapanınca yarım kalan basış bir sonraki açılışa devredilmez', async () => {
    jest.useFakeTimers();
    try {
      const onConfirm = jest.fn();
      const screen = await render(
        <DataResetModal visible summary={summary} onCancel={noop} onConfirm={onConfirm} />,
      );

      await fireEvent(screen.getByTestId('data-reset-confirm'), 'pressIn');
      await advance(HOLD_TO_CONFIRM_MS - 300);
      await screen.rerender(
        <DataResetModal
          visible={false}
          summary={summary}
          onCancel={noop}
          onConfirm={onConfirm}
        />,
      );
      await advance(HOLD_TO_CONFIRM_MS);

      expect(onConfirm).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('silme sürerken basış hiç başlamaz ve vazgeç kilitlidir', async () => {
    jest.useFakeTimers();
    try {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();
      const screen = await render(
        <DataResetModal visible summary={summary} busy onCancel={onCancel} onConfirm={onConfirm} />,
      );

      await fireEvent(screen.getByTestId('data-reset-confirm'), 'pressIn');
      await advance(HOLD_TO_CONFIRM_MS * 2);
      await fireEvent.press(screen.getByTestId('data-reset-cancel'));

      expect(onConfirm).not.toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('DataResetModal bilgilendirme', () => {
  it('yalnız gerçekten silinecek satırları sayıyla listeler', async () => {
    const screen = await render(
      <DataResetModal visible summary={summary} onCancel={noop} onConfirm={noop} />,
    );

    expect(screen.getByText('472')).toBeTruthy();
    expect(screen.getByText('data_reset_row_expenses')).toBeTruthy();
    // Sıfır olan kayıt türü listede hiç görünmez.
    expect(screen.queryByText('data_reset_row_products')).toBeNull();
    expect(screen.queryByText('data_reset_row_limits')).toBeNull();
  });

  it('neyin korunacağını da söyler — kapı yalnız uyarmaz, bilgilendirir', async () => {
    const screen = await render(
      <DataResetModal visible summary={summary} onCancel={noop} onConfirm={noop} />,
    );

    expect(screen.getByText('data_reset_preserved')).toBeTruthy();
    expect(screen.getByText('data_reset_backup_hint')).toBeTruthy();
  });
});
