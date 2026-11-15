import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import DraggablePanel from '../DraggablePanel';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));

// PanResponder, responder olaylarında dokunma geçmişini okur.
const touchEvent = (pageY: number) => ({
  nativeEvent: { pageY, locationY: 0, touches: [], changedTouches: [], identifier: 0, timestamp: 0 },
  touchHistory: {
    touchBank: [{
      touchActive: true, startPageX: 0, startPageY: pageY, startTimeStamp: 0,
      currentPageX: 0, currentPageY: pageY, currentTimeStamp: 1,
      previousPageX: 0, previousPageY: pageY, previousTimeStamp: 0,
    }],
    numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: 1,
  },
});

function renderPanel(overrides: Partial<React.ComponentProps<typeof DraggablePanel>> = {}) {
  const props = {
    id: 'chart', isEditing: true, shiftOffset: 0, isDragActive: false,
    onDragStart: jest.fn(), onDragMove: jest.fn(), onDragEnd: jest.fn(), onMoveBy: jest.fn(),
    position: 2, total: 5, reorderAccessibilityLabel: 'Reorder',
    ...overrides,
  };
  return { props, view: render(<DraggablePanel {...props}><Text>card</Text></DraggablePanel>) };
}

describe('DraggablePanel', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('ends the drag and stops edge auto-scroll when the gesture is terminated (FN-04)', async () => {
    const scrollTo = jest.fn();
    const { props, view } = renderPanel({
      scrollRef: { current: { scrollTo } } as any,
      scrollOffsetRef: { current: 0 },
    });
    const screen = await view;
    const handle = screen.getByTestId('drag-handle-chart');

    await fireEvent(handle, 'responderGrant', touchEvent(5));
    // Ekranın üst kenarında: otomatik kaydırma zamanlayıcısı başlar.
    await fireEvent(handle, 'responderMove', touchEvent(5));
    jest.advanceTimersByTime(50);
    const callsBeforeTerminate = scrollTo.mock.calls.length;
    expect(callsBeforeTerminate).toBeGreaterThan(0);

    await fireEvent(handle, 'responderTerminate', touchEvent(5));
    expect(props.onDragEnd).toHaveBeenCalledWith('chart');
    jest.advanceTimersByTime(200);
    expect(scrollTo.mock.calls.length).toBe(callsBeforeTerminate);
  });

  it('refuses to hand an active drag to another responder', async () => {
    const { view } = renderPanel();
    const screen = await view;
    expect(screen.getByTestId('drag-handle-chart').props.onResponderTerminationRequest()).toBe(false);
  });

  it('lets screen readers move the card one step (A11Y-03)', async () => {
    const { props, view } = renderPanel();
    const screen = await view;
    const handle = screen.getByTestId('drag-handle-chart');
    expect(handle.props.accessibilityRole).toBe('adjustable');
    expect(handle.props.accessibilityValue).toEqual({ min: 1, max: 5, now: 2 });
    await fireEvent(handle, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    await fireEvent(handle, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(props.onMoveBy).toHaveBeenNthCalledWith(1, 'chart', -1);
    expect(props.onMoveBy).toHaveBeenNthCalledWith(2, 'chart', 1);
  });
});
