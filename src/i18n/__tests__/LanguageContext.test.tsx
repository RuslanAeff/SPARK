import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { LanguageProvider, useLanguage } from '../LanguageContext';

jest.mock('../../db/database', () => ({
  getDatabase: jest.fn(() => new Promise(() => {})),
}));

function StartupProbe() {
  const { isLoaded } = useLanguage();
  return <Text>{isLoaded ? 'loaded' : 'loading-with-surface'}</Text>;
}

describe('LanguageProvider startup surface', () => {
  it('keeps rendering children while the stored locale is loading', async () => {
    const screen = await render(
      <LanguageProvider>
        <StartupProbe />
      </LanguageProvider>,
    );

    expect(screen.getByText('loading-with-surface')).toBeTruthy();
  });
});
