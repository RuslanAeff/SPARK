// S.P.A.R.K. — Dynamic Expo Config
// EAS projectId gizli bir değer değildir (projeyi tanımlar, yetki vermez); EAS CLI
// onu `app.json` > `extra.eas.projectId` içine yazar ve derleme oradan okur.
// `EAS_PROJECT_ID` ortam değişkeni tanımlıysa bu değeri ezer (ör. başka bir EAS
// projesine derlemek için). Bkz. .env.example. (SEC-04: eski yorum "kaynakta
// sabit literal yok" diyordu ve app.json ile çelişiyordu.)

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
  } else if (!(config.extra && config.extra.eas && config.extra.eas.projectId)
    && (process.env.EAS_BUILD || process.env.CI)) {
    // Ne app.json'da ne ortamda projectId var: yalnız derleme bağlamında uyar.
    console.warn('[app.config] EAS projectId yok (app.json veya EAS_PROJECT_ID); EAS build başarısız olabilir.');
  }

  return config;
};
