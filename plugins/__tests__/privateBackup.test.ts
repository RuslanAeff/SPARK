import fs from 'node:fs';
import path from 'node:path';
const { parseStringPromise } = require('xml2js');
it.each(['spark_backup_rules.xml', 'spark_data_extraction_rules.xml'])('excludes sensitive stores without expanding backup domains: %s', async name => {
  const xml = await parseStringPromise(fs.readFileSync(path.join(__dirname, '../android', name), 'utf8'));
  const scopes = xml['full-backup-content'] ? [xml['full-backup-content']] : [
    xml['data-extraction-rules']['cloud-backup'][0],
    xml['data-extraction-rules']['device-transfer'][0],
  ];
  for (const scope of scopes) {
    expect(scope.include).toEqual([{ $: { domain: 'sharedpref', path: '.' } }]);
    expect(scope.exclude.map((entry: any) => entry.$.path)).toEqual(expect.arrayContaining([
      'SecureStore', 'SecureStore.xml', 'expo.modules.notifications.SharedPreferencesNotificationsStore.xml',
    ]));
  }
});
it('blocks overlay and keeps preview APK while production uses AAB', () => {
  const app = require('../../app.json').expo;
  expect(app.android.blockedPermissions).toContain('android.permission.SYSTEM_ALERT_WINDOW');
  const eas = require('../../eas.json');
  expect(eas.build.production.android.buildType).toBe('app-bundle');
  expect(eas.build.preview.android.buildType).toBe('apk');
});
