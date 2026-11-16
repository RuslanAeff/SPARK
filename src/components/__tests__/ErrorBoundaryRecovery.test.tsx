import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ErrorBoundary } from '../ErrorBoundary';

let mockLanguage: { language: string } | undefined;
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../theme/themeStore', () => ({ useAppTheme: () => 'dark', useThemeRevision: () => 0 }));
jest.mock('../../utils/logError', () => ({ reportErrorKind: jest.fn() }));
jest.mock('../../i18n/LanguageContext', () => ({ useOptionalLanguage: () => mockLanguage }));
jest.mock('../../i18n/languageOptions', () => ({ suggestLanguageFromDevice: () => 'en' }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));

let shouldThrow = true;
function Boom() {
  if (shouldThrow) throw new Error('SYNTHETIC_PRIVATE_MARKER');
  return null;
}

describe('ErrorBoundary recovery screen (A11Y-04)', () => {
  const previousDev = __DEV__;
  beforeEach(() => {
    (globalThis as any).__DEV__ = false;
    shouldThrow = true;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    (globalThis as any).__DEV__ = previousDev;
    jest.restoreAllMocks();
  });

  it('uses the app language when the provider is available', async () => {
    mockLanguage = { language: 'tr' };
    const screen = await render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText('Bir şeyler ters gitti')).toBeTruthy();
    expect(screen.getByRole('header')).toBeTruthy();
    expect(screen.queryByText(/SYNTHETIC_PRIVATE_MARKER/)).toBeNull();
  });

  it('falls back to the device language without a provider and retries', async () => {
    mockLanguage = undefined;
    const screen = await render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    shouldThrow = false;
    await fireEvent.press(screen.getByTestId('error-recovery-retry'));
    expect(screen.queryByTestId('error-recovery-screen')).toBeNull();
  });
});
