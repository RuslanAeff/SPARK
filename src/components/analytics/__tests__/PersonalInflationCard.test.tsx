// react-native-reanimated → __mocks__/react-native-reanimated.js (otomatik)
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PersonalInflationCard from '../PersonalInflationCard';
import { getAnalyticsStyles } from '../analyticsStyles';
import { computePersonalInflation } from '../../../utils/personalInflation';
import { Colors } from '../../../theme/colors';

jest.mock('../../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ language: 'tr', t: (key: string) => key }),
}));
jest.mock('../../SettingsInfoHint', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    SettingsInfoIconButton: ({ onPress, accessibilityLabel }: any) => (
      React.createElement(Pressable, { testID: 'inflation-info', accessibilityLabel, onPress })
    ),
    SettingsInfoHintModal: ({ visible, title, paragraphs }: any) => (visible ? (
      React.createElement(View, null,
        React.createElement(Text, null, title),
        ...paragraphs.map((paragraph: string) => React.createElement(Text, { key: paragraph }, paragraph)),
      )
    ) : null),
  };
});

const base = {
  styles: getAnalyticsStyles(),
  t: (key: string) => key,
  tc: (key: string) => key,
  currency: 'PLN' as const,
};

describe('PersonalInflationCard', () => {
  it('iki dönem yoksa geçmiş boş durumunu gösterir', async () => {
    const info = computePersonalInflation([], []);
    const screen = await render(<PersonalInflationCard {...base} inflationInfo={info} />);

    expect(screen.getByTestId('inflation-empty')).toBeTruthy();
    expect(screen.getByText('inflation_empty_history_title')).toBeTruthy();
  });

  it('ortak ürün yoksa sepet boş durumunu gösterir', async () => {
    const info = computePersonalInflation(
      [{ key: 'yeni', name: 'Yeni', unitPrice: 10, quantity: 1, totalPrice: 10 }],
      [{ key: 'eski', name: 'Eski', unitPrice: 10, quantity: 1, totalPrice: 10 }],
    );
    const screen = await render(<PersonalInflationCard {...base} inflationInfo={info} />);

    expect(screen.getByText('inflation_empty_basket_title')).toBeTruthy();
  });

  it('enflasyonu, iki etkiyi ve kapsamı birlikte gösterir', async () => {
    const info = computePersonalInflation(
      [{ key: 'ekmek', name: 'Ekmek', unitPrice: 6, quantity: 10, totalPrice: 60 }],
      [{ key: 'ekmek', name: 'Ekmek', unitPrice: 5, quantity: 10, totalPrice: 50 }],
    );
    const screen = await render(<PersonalInflationCard {...base} inflationInfo={info} />);

    // %20 fiyat artışı, sepet değişimi yok.
    expect(screen.getByTestId('inflation-hero')).toHaveTextContent(/20/);
    expect(screen.getByTestId('inflation-price-effect')).toBeTruthy();
    expect(screen.getByTestId('inflation-behavior-effect')).toBeTruthy();
    expect(screen.getByTestId('inflation-coverage-text')).not.toHaveStyle({
      color: Colors.warning,
    });
    // Fiyatı en çok etkileyen ürün adıyla listelenir.
    expect(screen.getByText('Ekmek')).toBeTruthy();
  });

  it('ucuzlamayı eksi işaretiyle sunar', async () => {
    const info = computePersonalInflation(
      [{ key: 'domates', name: 'Domates', unitPrice: 15, quantity: 4, totalPrice: 60 }],
      [{ key: 'domates', name: 'Domates', unitPrice: 20, quantity: 4, totalPrice: 80 }],
    );
    const screen = await render(<PersonalInflationCard {...base} inflationInfo={info} />);

    expect(screen.getByTestId('inflation-hero')).toHaveTextContent(/25/);
    expect(screen.getByTestId('inflation-hero')).not.toHaveTextContent(/\+/);
  });

  it('oran şeridini iki etkinin büyüklüğüne göre paylaştırır', async () => {
    // Fiyat etkisi 10, sepet etkisi 30 → şerit %25 / %75.
    const info = computePersonalInflation(
      [{ key: 'a', name: 'A', unitPrice: 11, quantity: 4, totalPrice: 44 }],
      [{ key: 'a', name: 'A', unitPrice: 10, quantity: 1, totalPrice: 10 }],
    );
    const screen = await render(<PersonalInflationCard {...base} inflationInfo={info} />);
    const segments = screen.getByTestId('inflation-bar').children as any[];

    expect(info.priceEffectAmount).toBe(1);
    expect(info.behaviorEffectAmount).toBe(33);
    expect(segments[0].props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: `${(1 / 34) * 100}%` })]),
    );
  });

  it('toplam değişimi ayrı bir satırda kapanış olarak verir', async () => {
    const info = computePersonalInflation(
      [{ key: 'a', name: 'A', unitPrice: 12, quantity: 10, totalPrice: 120 }],
      [{ key: 'a', name: 'A', unitPrice: 10, quantity: 10, totalPrice: 100 }],
    );
    const screen = await render(<PersonalInflationCard {...base} inflationInfo={info} />);

    expect(screen.getByTestId('inflation-total')).toHaveTextContent(/20/);
  });

  it('kapsam düşükse notu uyarı tonuna çevirir', async () => {
    // Ortak ürün baz harcamanın yalnız %20'si → düşük kapsam.
    const info = computePersonalInflation(
      [{ key: 'ortak', name: 'Ortak', unitPrice: 12, quantity: 1, totalPrice: 12 }],
      [
        { key: 'ortak', name: 'Ortak', unitPrice: 10, quantity: 1, totalPrice: 10 },
        { key: 'tek', name: 'Tek', unitPrice: 40, quantity: 1, totalPrice: 40 },
      ],
    );
    const screen = await render(<PersonalInflationCard {...base} inflationInfo={info} />);

    expect(info.coveragePct).toBe(20);
    expect(screen.getByTestId('inflation-coverage-text')).toHaveStyle({
      color: Colors.warning,
    });
  });

  it('indirim verisi varsa fiyat etkisini etiket ve kampanya satırlarına ayırır', async () => {
    const info = computePersonalInflation(
      [{ key: 'a', name: 'A', unitPrice: 6, listUnitPrice: 11, quantity: 10, totalPrice: 60 }],
      [{ key: 'a', name: 'A', unitPrice: 10, listUnitPrice: 10, quantity: 10, totalPrice: 100 }],
    );
    const screen = await render(<PersonalInflationCard {...base} inflationInfo={info} />);

    expect(screen.getByTestId('inflation-list-effect')).toBeTruthy();
    expect(screen.getByTestId('inflation-discount-effect')).toBeTruthy();
    expect(screen.queryByTestId('inflation-price-effect')).toBeNull();
    // Şerit üç segmentli olur.
    expect((screen.getByTestId('inflation-bar').children as any[]).length).toBe(3);
    // Etiket fiyatı artmış (kırmızı), ödenen düşmüş (yeşil manşet).
    expect(screen.getByTestId('inflation-list-effect')).toHaveTextContent(/10/);
    expect(screen.getByTestId('inflation-hero')).toHaveTextContent(/40/);
  });

  it('(i) butonuna dokunulunca hesap açıklamasını gösterir, kapsam notu kısa kalır', async () => {
    const info = computePersonalInflation(
      [{ key: 'a', name: 'A', unitPrice: 11, quantity: 1, totalPrice: 11 }],
      [{ key: 'a', name: 'A', unitPrice: 10, quantity: 1, totalPrice: 10 }],
    );
    const screen = await render(<PersonalInflationCard {...base} inflationInfo={info} />);

    // Modal başta kapalı; kapsam notu kısa, uzun açıklama kartta değil.
    expect(screen.queryByText('inflation_info_basket')).toBeNull();
    expect(screen.getByTestId('inflation-coverage-text')).toHaveTextContent(
      /inflation_coverage_note_short/,
    );

    await fireEvent.press(screen.getByTestId('inflation-info'));

    expect(screen.getByText('inflation_info_basket')).toBeTruthy();
    expect(screen.getByText('inflation_info_coverage')).toBeTruthy();
  });
});
