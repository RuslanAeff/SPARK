/**
 * Yerel hata günlüğü — kullanıcı onayıyla paylaşılan teknik rapor.
 *
 * Gizlilik sınırı (bkz. ADR-016):
 * - Kayıtlar yalnız cihazda, uygulama belge klasöründeki küçük bir dosyada tutulur;
 *   hiçbir ağ çağrısı yapılmaz. Kullanıcı "Paylaş" demedikçe cihazdan çıkmaz.
 * - SQLite'a yazılmaz: hatalar her an gelir ve aynı bağlantıda paralel yazı
 *   ADR-002'yi ihlal ederdi. Dosya veritabanı yedeğine ve Android otomatik
 *   yedeğine (yalnız sharedpref) girmez; "tüm verileri sil" ile temizlenir.
 * - Kayıt yalnız etiket, hata türü ve süzülmüş kısa teknik açıklama içerir.
 *   Finansal değer, ad, dosya yolu ve uzun sayılar yazılmadan önce silinir.
 * - Eşzamanlı (sync) dosya API'si: çökme anında bile kayıt düşer; hiçbir fonksiyon fırlatmaz.
 */
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { setErrorSink } from '../utils/logError';

export interface ErrorJournalEntry {
  /** ISO zaman damgası */
  at: string;
  tag: string;
  kind: string;
  detail: string | null;
}

export const ERROR_JOURNAL_LIMIT = 200;
const FILE_NAME = 'error-journal.json';
const TAG_MAX = 80;
const DETAIL_MAX = 200;

let cache: ErrorJournalEntry[] | null = null;

function journalFile(): File {
  return new File(Paths.document, FILE_NAME);
}

function isEntry(value: unknown): value is ErrorJournalEntry {
  const v = value as Partial<ErrorJournalEntry> | null;
  return !!v && typeof v.at === 'string' && typeof v.tag === 'string'
    && typeof v.kind === 'string' && (v.detail === null || typeof v.detail === 'string');
}

function load(): ErrorJournalEntry[] {
  if (cache) return cache;
  cache = [];
  try {
    const file = journalFile();
    if (file.exists) {
      const parsed: unknown = JSON.parse(file.textSync());
      if (Array.isArray(parsed)) cache = parsed.filter(isEntry).slice(-ERROR_JOURNAL_LIMIT);
    }
  } catch {
    /* bozuk veya okunamayan dosya: boş günlükle devam */
  }
  return cache;
}

function persist(entries: ErrorJournalEntry[]): void {
  try {
    const file = journalFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(entries));
  } catch {
    /* disk dolu vb.: kayıt kaybı uygulamayı etkilemez */
  }
}

function clip(value: string, max: number): string {
  // Kontrol karakterleri ve yön işaretleri; vekil çifti ortadan bölünmez.
  let s = value
    .replace(/[\x00-\x1F\x7F​-‏‪-‮⁠⁦-⁩﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > max) {
    s = s.slice(0, max);
    const last = s.charCodeAt(s.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) s = s.slice(0, -1);
  }
  return s;
}

/**
 * Hata metnindeki kişisel veya finansal olabilecek parçaları siler. Teknik
 * kodlar ("INVALID_FORMAT", "database is locked") okunur kalır.
 */
export function redactErrorDetail(message: unknown): string | null {
  if (typeof message !== 'string' || !message.trim()) return null;
  const redacted = message
    .replace(/AIza[\w-]{20,}/g, '<secret>')
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<uri>')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<email>')
    .replace(/(?:\/[\w.@%-]+){2,}\/?/g, '<path>')
    .replace(/"[^"]*"|'[^']*'|`[^`]*`|«[^»]*»|“[^”]*”/g, '<text>')
    .replace(/\d+[.,]\d+/g, '<n>')
    .replace(/\d{3,}/g, '<n>');
  return clip(redacted, DETAIL_MAX) || null;
}

function errorKind(error: unknown): string {
  try {
    if (error instanceof Error) return clip(error.name || 'Error', 40) || 'Error';
    if (error === null || error === undefined) return 'none';
    return typeof error;
  } catch {
    return 'unknown';
  }
}

function errorDetail(error: unknown): string | null {
  try {
    if (!(error instanceof Error)) return null;
    const detail = redactErrorDetail(error.message);
    // Uygulamanın kendi tanılama alanı (ör. yedek öz denetim bölümü) — sabit enum.
    const section = (error as { section?: unknown }).section;
    const safeSection = typeof section === 'string' && /^[a-z_]{1,40}$/.test(section) ? section : null;
    if (!detail) return safeSection;
    return safeSection ? `${detail} (${safeSection})` : detail;
  } catch {
    return null;
  }
}

/** Hata günlüğüne bir kayıt ekler. Asla fırlatmaz. */
export function recordError(
  tag: string,
  error?: unknown,
  options: { includeDetail?: boolean } = {},
): void {
  try {
    const entries = load();
    entries.push({
      at: new Date().toISOString(),
      tag: clip(String(tag), TAG_MAX) || 'unknown',
      kind: errorKind(error),
      detail: options.includeDetail === false ? null : errorDetail(error),
    });
    if (entries.length > ERROR_JOURNAL_LIMIT) entries.splice(0, entries.length - ERROR_JOURNAL_LIMIT);
    persist(entries);
  } catch {
    /* hata yolunda ikinci hata üretme */
  }
}

/** En yeni kayıt önce. */
export function readErrorJournal(): ErrorJournalEntry[] {
  try {
    return [...load()].reverse();
  } catch {
    return [];
  }
}

export function clearErrorJournal(): void {
  cache = [];
  try {
    const file = journalFile();
    if (file.exists) file.delete();
  } catch {
    /* sonraki kayıt dosyayı yeniden yazar */
  }
}

/** Kullanıcının paylaşacağı düz metin rapor. Yalnız sürüm/platform + kayıtlar. */
export function buildErrorReport(entries: ErrorJournalEntry[], now: Date = new Date()): string {
  const version = Constants.expoConfig?.version ?? 'unknown';
  const lines = [
    'S.P.A.R.K. error report',
    `App version: ${version}`,
    `Platform: ${Platform.OS} ${String(Platform.Version)}`,
    `Generated: ${now.toISOString()}`,
    `Entries: ${entries.length}`,
    '',
    ...entries.map(e => `${e.at}  [${e.tag}]  ${e.kind}${e.detail ? `: ${e.detail}` : ''}`),
  ];
  return lines.join('\n');
}

let installed = false;

/**
 * Uygulama açılışında bir kez çağrılır: `logError` kapısını günlüğe bağlar ve
 * yakalanmamış JS hatalarını (kırmızı ekran / çökme) günlüğe düşürüp önceki
 * işleyiciye devreder. Native çökmeler kapsam dışıdır.
 */
export function installErrorJournal(): void {
  if (installed) return;
  installed = true;
  setErrorSink((tag, error, options) => recordError(tag, error, options));
  try {
    const errorUtils = (globalThis as {
      ErrorUtils?: {
        getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
        setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
      };
    }).ErrorUtils;
    if (errorUtils?.getGlobalHandler && errorUtils.setGlobalHandler) {
      const previous = errorUtils.getGlobalHandler();
      errorUtils.setGlobalHandler((error, isFatal) => {
        recordError(isFatal ? 'JS fatal error' : 'JS unhandled error', error);
        previous?.(error, isFatal);
      });
    }
  } catch {
    /* genel işleyici kurulamazsa günlük yine logError üzerinden çalışır */
  }
}

/** Yalnız testler için: bellek önbelleğini sıfırlar (uygulama yeniden açılışı gibi). */
export function __resetErrorJournalForTests(): void {
  cache = null;
}
