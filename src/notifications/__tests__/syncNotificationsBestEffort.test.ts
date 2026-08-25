import { syncNotificationsBestEffort } from '../syncNotificationsBestEffort';

describe('syncNotificationsBestEffort', () => {
  it('does not turn a committed domain write into a rejected user action', async () => {
    const sync = jest.fn().mockRejectedValue(new Error('native inventory unavailable'));

    await expect(syncNotificationsBestEffort(sync, 'test-domain-write')).resolves.toBeUndefined();
    expect(sync).toHaveBeenCalledTimes(1);
  });
});
