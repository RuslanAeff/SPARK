// S.P.A.R.K. — ESLint yapılandırması (UI denetimi CQ-01, 15 Kasım 2026)
//
// İki hook kuralı da HATA ve CI'da bloklayıcı:
//   • `rules-of-hooks`: koşullu hook çağrısı ekranı çökertir (ilk çalıştırmada
//     DonutCard'da gerçek örnek bulundu).
//   • `exhaustive-deps`: eksik bağımlılık ekranda eski veri gösterir. Tema
//     kalıbının 54 yanlış alarmı ortak `useThemedStyles` hook'uyla bitti;
//     bileşen içi yükleyiciler `useLatestCallback` ile sabitlendi. Kalan
//     birkaç bilinçli istisna satırında gerekçesiyle işaretli (21 Kasım 2026).
//
// Toplu otomatik düzeltme veya biçimlendirme yapılmaz. Bilinçli istisnalar
// gerekçeli `eslint-disable-next-line` ile işaretlenir.
const { defineConfig } = require('eslint/config');
const globals = require('globals');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['node_modules/**', 'android/**', 'ios/**', '.expo/**', 'artifacts/**', 'dist/**', 'coverage/**'],
  },
  {
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    // Jest mock fabrikaları anonim bileşen döndürür ve `jest.mock` hoist edildiği
    // için `require` ile import sırası Jest'in zorunlu kalıbıdır.
    files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx', '__mocks__/**'],
    rules: {
      'react/display-name': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'import/first': 'off',
    },
  },
  {
    // Expo config eklentileri ve betikler Node ortamında çalışır.
    files: ['plugins/**/*.js', 'scripts/**/*.{js,cjs,mjs}', '*.config.js', 'app.config.js'],
    languageOptions: { globals: globals.node },
  },
]);
