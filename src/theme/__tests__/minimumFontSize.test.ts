// UI denetimi DS-09: ölçeğin en küçük basamağı `Typography.labelTiny` (10 px).
// Ürün kodunda bunun altında sabit yazı boyutu kullanılmaz.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

it('no production style uses a font size below 10', () => {
  const offenders = [...sourceFiles(path.join(ROOT, 'app')), ...sourceFiles(path.join(ROOT, 'src'))]
    .flatMap(file => fs.readFileSync(file, 'utf8').split('\n').flatMap((line, index) => {
      const match = /fontSize:\s*(\d+(?:\.\d+)?)\b/.exec(line);
      return match && Number(match[1]) < 10 ? [`${path.relative(ROOT, file)}:${index + 1}`] : [];
    }));
  expect(offenders).toEqual([]);
});
