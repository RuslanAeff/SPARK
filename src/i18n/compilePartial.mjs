import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const locales = path.join(__dirname, 'locales');

function compile(prefix, outName) {
  const parts = [];
  for (let i = 1; i <= 8; i++) {
    const p = path.join(locales, `${prefix}-${i}.json`);
    if (!fs.existsSync(p)) throw new Error('Missing ' + p);
    parts.push(JSON.parse(fs.readFileSync(p, 'utf8')));
  }
  const merged = Object.assign({}, ...parts);
  fs.writeFileSync(path.join(locales, outName), JSON.stringify(merged, null, 2), 'utf8');
  console.log(outName, Object.keys(merged).length);
}

compile('map-ru', 'ru-partial.json');
compile('map-az', 'az-partial.json');
