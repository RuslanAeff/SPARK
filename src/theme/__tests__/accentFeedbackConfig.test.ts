// S.P.A.R.K. — Vurgu seçici sesinin izin ve arka plan sınırları

const appConfig = require('../../../app.json').expo;

describe('accent detent audio config', () => {
  it('mikrofon iznini engeller ve kayıt/arka plan kabiliyetlerini açmaz', () => {
    expect(appConfig.android.blockedPermissions).toContain(
      'android.permission.RECORD_AUDIO',
    );

    const audioPlugin = appConfig.plugins.find(
      (entry: unknown) => Array.isArray(entry) && entry[0] === 'expo-audio',
    );
    expect(audioPlugin).toEqual([
      'expo-audio',
      {
        microphonePermission: false,
        recordAudioAndroid: false,
        enableBackgroundPlayback: false,
        enableBackgroundRecording: false,
      },
    ]);
  });

  it('kısa yerel PCM ses varlığını paket içinde tutar', () => {
    const asset = require('../../../assets/audio/palette-detent.wav');
    expect(asset).toBeTruthy();
  });
});
