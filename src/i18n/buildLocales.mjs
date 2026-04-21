/**
 * _en.json + *-partial.json → ru.json / az.json (tam açar örtüyü)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(fs.readFileSync(path.join(__dirname, 'locales', '_en.json'), 'utf8'));

function build(name) {
  const partialPath = path.join(__dirname, 'locales', `${name}-partial.json`);
  const partial = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
  const out = { ...base };
  for (const k of Object.keys(partial)) {
    out[k] = partial[k];
  }
  for (const k of Object.keys(base)) {
    if (!(k in out) || out[k] === undefined) {
      console.warn(`[${name}] missing key:`, k);
    }
  }
  fs.writeFileSync(path.join(__dirname, 'locales', `${name}.json`), JSON.stringify(out, null, 2), 'utf8');
  console.log(name, '→', Object.keys(out).length, 'keys');
}

build('ru');
build('az');
