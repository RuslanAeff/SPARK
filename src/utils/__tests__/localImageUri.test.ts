import { isLocalImageUri } from '../localImageUri';
it.each(['https://example.invalid/a', 'http://example.invalid/a', '//example.invalid/a', 'data:image/png;base64,eA==', 'file://host/a'])('blocks nonlocal image %s', uri => {
  expect(isLocalImageUri(uri)).toBe(false);
});
it.each(['file:///cache/picker.png', 'content://media/1', 'ph://asset/1'])('accepts local picker source %s', uri => {
  expect(isLocalImageUri(uri)).toBe(true);
});
