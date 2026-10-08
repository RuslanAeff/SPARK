jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../theme/themeStore', () => ({ useThemeRevision: jest.fn() }));
import { ErrorBoundary } from '../ErrorBoundary';

it.each([false, true])('does not log raw error data (development=%s)', dev => {
  const previous = __DEV__;
  (globalThis as any).__DEV__ = dev;
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const boundary = new ErrorBoundary({ children: null });
    boundary.setState = jest.fn();
    boundary.componentDidCatch(new Error('SYNTHETIC_PRIVATE_MARKER'), {
      componentStack: 'SYNTHETIC_PRIVATE_STACK',
    });
    expect(log).toHaveBeenCalledWith('[UI] UNCAUGHT_RENDER_ERROR');
    expect(JSON.stringify(log.mock.calls)).not.toContain('SYNTHETIC_PRIVATE');
  } finally {
    log.mockRestore();
    (globalThis as any).__DEV__ = previous;
  }
});
