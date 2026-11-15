// S.P.A.R.K. — ESLint yapılandırması (UI denetimi CQ-01, 15 Kasım 2026)
//
// İlk aşama bilinçli olarak dar ve CI'da bloklayıcı olan tek kural
// `react-hooks/rules-of-hooks`'tur: koşullu hook çağrısı ekranı çökertir
// (ilk çalıştırmada DonutCard'da gerçek örnek bulundu).
//
// `react-hooks/exhaustive-deps` şimdilik UYARI: projenin zorunlu tema kalıbı
// `useMemo(() => getStyles(), [scheme, themeRevision])` Colors proxy'sini izlediği
// için kurala "gereksiz bağımlılık" gibi görünür (≈55 yanlış alarm). Gerçek eksik
// bağımlılıklar ilgili denetim bulgularında tek tek düzeltilir; tema kalıbı ortak
// bir hook'a taşınınca bu kural hataya yükseltilebilir.
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
      'react-hooks/exhaustive-deps': 'warn',
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
