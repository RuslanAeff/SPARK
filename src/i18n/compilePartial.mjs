import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const locales = path.join(__dirname, 'locales');

function compile(prefix, outName) {
  // Tüm `${prefix}-N.json` parçalarını dinamik bul + sayıya göre sırala (sabit 1..8
  // sınırı yok → yeni parti dosyaları map-az-9, map-az-10... eklenebilir). Sonraki
  // dosya çakışan anahtarı ezer (Object.assign sırası); yeni anahtarlar çakışmaz.
  const re = new RegExp(`^${prefix}-(\\d+)\\.json$`);
  const files = fs
    .readdirSync(locales)
    .map((f) => {
      const m = f.match(re);
      return m ? { f, n: Number(m[1]) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.n - b.n);
  if (files.length === 0) throw new Error('No parts for ' + prefix);
  const parts = files.map(({ f }) => JSON.parse(fs.readFileSync(path.join(locales, f), 'utf8')));
  const merged = Object.assign({}, ...parts);
  fs.writeFileSync(path.join(locales, outName), JSON.stringify(merged, null, 2), 'utf8');
  console.log(outName, Object.keys(merged).length, `(${files.length} parça)`);
}

compile('map-ru', 'ru-partial.json');
compile('map-az', 'az-partial.json');
