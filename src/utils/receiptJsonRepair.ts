/**
 * Gemini fiş yanıtları bazen geçersiz JSON döndürür (markdown, sondaki virgül,
 * kesik çıktı, string içinde '{' ile kırık süslü parantez sayımı vb.).
 */

/** İlk dengeli `{ ... }` bloğunu string sınırlarını sayarak çıkarır. */
export function extractFirstBalancedJsonObject(input: string): string | null {
  const start = input.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < input.length; i++) {
    const c = input[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\' && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return input.slice(start, i + 1);
    }
  }
  return null;
}

/** JSON dışındaki sondaki virgülleri kaldırır (`,}` ve `,]`). */
export function stripTrailingCommasJson(s: string): string {
  let out = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      out += c;
      continue;
    }
    if (c === '\\' && inString) {
      escape = true;
      out += c;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      out += c;
      continue;
    }
    if (!inString && c === ',') {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j++;
      if (j < s.length && (s[j] === '}' || s[j] === ']')) {
        continue;
      }
    }
    out += c;
  }
  return out;
}

/** Yaygın geçersiz JSON sabitleri (model bazen üretir). */
export function relaxInvalidJsonLiterals(s: string): string {
  return s
    .replace(/:\s*NaN\b/g, ': null')
    .replace(/:\s*Infinity\b/g, ': null')
    .replace(/:\s*-Infinity\b/g, ': null')
    .replace(/:\s*undefined\b/g, ': null');
}

const FENCE_JSON = /^```(?:json)?\s*/i;
const FENCE_END = /```\s*$/;

/** ```json ... ``` ve benzeri sarmalayıcıları kaldırır. */
export function stripMarkdownCodeFences(content: string): string {
  let t = content.trim().replace(/^\uFEFF/, '');
  if (FENCE_JSON.test(t)) {
    t = t.replace(FENCE_JSON, '');
  } else if (t.startsWith('```')) {
    t = t.slice(3);
  }
  t = t.trim();
  if (FENCE_END.test(t)) {
    t = t.replace(FENCE_END, '').trim();
  } else if (t.endsWith('```')) {
    t = t.slice(0, -3).trim();
  }
  return t;
}
