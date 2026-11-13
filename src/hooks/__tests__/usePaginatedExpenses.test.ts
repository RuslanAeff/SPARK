import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockGetAll = jest.fn();
jest.mock('../../db/expenseDao', () => ({ ExpenseDao: { getAll: (...a: unknown[]) => mockGetAll(...a) } }));

import { usePaginatedExpenses } from '../useExpenses';

const rows = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: from + i }) as any);

describe('usePaginatedExpenses refresh (BUG-25)', () => {
  it('keeps every already loaded row after a refresh instead of dropping back to the first page', async () => {
    mockGetAll.mockImplementation(async (limit: number, offset: number) => rows(offset + 1, Math.min(limit, 500 - offset)));
    const { result } = await renderHook(() => usePaginatedExpenses(60));
    await waitFor(() => expect(result.current.items).toHaveLength(60));

    await act(async () => { await result.current.loadMore(); });
    await act(async () => { await result.current.loadMore(); });
    expect(result.current.items).toHaveLength(180);

    await act(async () => { await result.current.refresh(); });

    expect(mockGetAll).toHaveBeenLastCalledWith(180, 0);
    expect(result.current.items).toHaveLength(180);
    expect(result.current.hasMore).toBe(true);
  });
});
