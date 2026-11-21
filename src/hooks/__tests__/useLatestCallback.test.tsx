import { renderHook } from '@testing-library/react-native';

import { useLatestCallback } from '../useLatestCallback';

it('keeps one identity and always calls the latest function', async () => {
  const { result, rerender } = await renderHook(({ value }: { value: number }) => useLatestCallback(() => value), {
    initialProps: { value: 1 },
  });
  const first = result.current;
  expect(first()).toBe(1);
  await rerender({ value: 2 });
  expect(result.current).toBe(first);
  expect(first()).toBe(2);
});
