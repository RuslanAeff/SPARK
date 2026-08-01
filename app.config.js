// S.P.A.R.K. — Dynamic Expo Config
// S10: EAS projectId YALNIZCA ortam değişkeninden okunur; kaynak kodda sabit literal yok.
// Kullanım: yerelde `.env` (EAS_PROJECT_ID=...) — bkz. .env.example; EAS/CI'da secret olarak tanımlanır.

module.exports = ({ config: staticConfig }) => {
  // Expo'nun app.json'dan çözdüğü config'i temel al. Bu, static + dynamic
  // config zincirini resmi akışta tutar ve expo-doctor'ın iki kaynağı ayrı
  // sanmasını engeller.
  const config = { ...staticConfig };

  const easProjectId = process.env.EAS_PROJECT_ID;
  if (easProjectId) {
    config.extra = {
      ...config.extra,
      eas: {
        ...(config.extra && config.extra.eas),
        projectId: easProjectId,
      },
    };
  } else if (process.env.EAS_BUILD || process.env.CI) {
    // Yalnızca gerçekten gerektiği bağlamda uyar — yerel `expo start` gürültü yapmasın.
    console.warn('[app.config] EAS_PROJECT_ID tanımlı değil; EAS build projectId olmadan başarısız olabilir.');
  }

  return config;
};
