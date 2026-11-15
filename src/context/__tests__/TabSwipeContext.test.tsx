import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

import { TabSwipeProvider, useTabSwipe } from '../TabSwipeContext';

type Api = ReturnType<typeof useTabSwipe>;
const apis: Record<string, Api> = {};

function Owner({ name }: { name: string }) {
  apis[name] = useTabSwipe();
  return null;
}
function Probe() {
  return <Text testID="enabled">{String(useTabSwipe().swipeEnabled)}</Text>;
}

describe('TabSwipeContext ownership (FN-05)', () => {
  it('stays locked until every owner releases', async () => {
    const screen = await render(
      <TabSwipeProvider><Owner name="editMode" /><Owner name="chart" /><Probe /></TabSwipeProvider>,
    );
    await act(async () => {
      apis.editMode.setNestedHorizontalGestureActive(true);
      apis.chart.setNestedHorizontalGestureActive(true);
    });
    expect(screen.getByTestId('enabled').props.children).toBe('false');

    // Grafik dokunması biter: düzenleme modu hâlâ kilitli tutuyor.
    await act(async () => { apis.chart.setNestedHorizontalGestureActive(false); });
    expect(screen.getByTestId('enabled').props.children).toBe('false');

    await act(async () => { apis.editMode.setNestedHorizontalGestureActive(false); });
    expect(screen.getByTestId('enabled').props.children).toBe('true');
  });

  it('a releasing owner cannot unlock someone else and unmount releases its own lock', async () => {
    const screen = await render(
      <TabSwipeProvider><Owner key="a" name="a" /><Owner key="b" name="b" /><Probe /></TabSwipeProvider>,
    );
    await act(async () => { apis.a.setNestedHorizontalGestureActive(true); });
    await act(async () => { apis.b.setNestedHorizontalGestureActive(false); });
    expect(screen.getByTestId('enabled').props.children).toBe('false');

    await screen.rerender(<TabSwipeProvider><Owner key="b" name="b" /><Probe /></TabSwipeProvider>);
    expect(screen.getByTestId('enabled').props.children).toBe('true');
  });
});
