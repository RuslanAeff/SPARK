// S.P.A.R.K. — Dynamic Expo Config
// S10: EAS projectId ortam değişkeninden okunur, kaynak kodda sabit değil.
// Kullanım: EAS_PROJECT_ID=xxx npx eas build ...

const baseConfig = require('./app.json');

module.exports = () => {
  const config = { ...baseConfig.expo };

  // EAS projectId: CI’da EAS_PROJECT_ID; yerelde aynı Expo projesine bağlanmak için fallback
  const easProjectId =
    process.env.EAS_PROJECT_ID || '6e22ef61-4027-4f79-811b-cde50765e90e';
  config.extra = {
    ...config.extra,
    eas: {
      ...(config.extra && config.extra.eas),
      projectId: easProjectId,
    },
  };

  return config;
};
