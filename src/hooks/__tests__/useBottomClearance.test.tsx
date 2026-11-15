import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useBottomClearance } from '../useBottomClearance';
import { TAB_BAR_FLOAT_GAP, TAB_BAR_HEIGHT } from '../../theme/layout';
import { Spacing } from '../../theme/spacing';

function Probe({ kind, extra }: { kind: 'tab' | 'screen'; extra?: number }) {
  return <Text testID="value">{String(useBottomClearance(kind, extra))}</Text>;
}

const withInsets = (bottom: number, node: React.ReactElement) => (
  <SafeAreaInsetsContext.Provider value={{ top: 0, left: 0, right: 0, bottom }}>{node}</SafeAreaInsetsContext.Provider>
);

describe('useBottomClearance (UX-06)', () => {
  it('clears the floating tab bar plus the system navigation area', async () => {
    const gesture = await render(withInsets(16, <Probe kind="tab" />));
    expect(gesture.getByTestId('value').props.children).toBe(String(16 + TAB_BAR_FLOAT_GAP + TAB_BAR_HEIGHT + Spacing.xl));
    // Üç düğmeli gezinme daha yüksek: boşluk da büyür (eskiden sabit 100'dü).
    const buttons = await render(withInsets(48, <Probe kind="tab" />));
    expect(Number(buttons.getByTestId('value').props.children)).toBeGreaterThan(Number(gesture.getByTestId('value').props.children));
  });

  it('adds only the system inset and the requested breathing room on sub-screens', async () => {
    const screen = await render(withInsets(48, <Probe kind="screen" extra={40} />));
    expect(screen.getByTestId('value').props.children).toBe('88');
  });

  it('falls back to zero inset without a provider', async () => {
    const screen = await render(<Probe kind="screen" extra={20} />);
    expect(screen.getByTestId('value').props.children).toBe('20');
  });
});
