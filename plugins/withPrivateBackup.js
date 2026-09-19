const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

module.exports = function withPrivateBackup(config) {
  config = withAndroidManifest(config, config => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    app.$['android:fullBackupContent'] = '@xml/spark_backup_rules';
    app.$['android:dataExtractionRules'] = '@xml/spark_data_extraction_rules';
    return config;
  });
  return withDangerousMod(config, ['android', async config => {
    const target = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    await fs.mkdir(target, { recursive: true });
    for (const name of ['spark_backup_rules.xml', 'spark_data_extraction_rules.xml']) {
      await fs.copyFile(path.join(__dirname, 'android', name), path.join(target, name));
    }
    return config;
  }]);
};
