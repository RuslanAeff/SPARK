import { getDatabase } from '../db/database';
import type { InAppNotification, RulesState, NotificationMuteChannel } from './types';

const K_FEED = 'notif_feed_v1';
const K_RULES = 'notif_rules_state_v1';
const K_MUTES = 'notif_mutes_v1';

const MAX_FEED = 40;

async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

/** Kaldırılan geliştirme “test bildirimleri ekle” kayıtları — senkron sırasında süzülür */
function isLegacyDevDemoNotificationId(id: string): boolean {
  if (id === 'receipt-saved-900001' || id === 'sys-demo-preview') return true;
  if (/^budget-\d{4}-\d{2}-demo$/.test(id)) return true;
  if (/^catlim-\d{4}-\d{2}-\d+-demo-(?:near|over)$/.test(id)) return true;
  if (/^goal-risk-\d{4}-\d{2}-demo$/.test(id)) return true;
  return false;
}

export function stripLegacyDevDemoNotifications(feed: InAppNotification[]): InAppNotification[] {
  return feed.filter((f) => !isLegacyDevDemoNotificationId(f.id));
}

export async function loadFeed(): Promise<InAppNotification[]> {
  try {
    const raw = await getSetting(K_FEED);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InAppNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveFeed(feed: InAppNotification[]): Promise<void> {
  const trimmed = feed.slice(0, MAX_FEED);
  await setSetting(K_FEED, JSON.stringify(trimmed));
}

export async function loadRulesState(): Promise<RulesState> {
  try {
    const raw = await getSetting(K_RULES);
    if (!raw) return {};
    return JSON.parse(raw) as RulesState;
  } catch {
    return {};
  }
}

export async function saveRulesState(s: RulesState): Promise<void> {
  await setSetting(K_RULES, JSON.stringify(s));
}

export async function loadMutes(): Promise<Partial<Record<NotificationMuteChannel, boolean>>> {
  try {
    const raw = await getSetting(K_MUTES);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Record<NotificationMuteChannel, boolean>>;
  } catch {
    return {};
  }
}

export async function saveMutes(m: Partial<Record<NotificationMuteChannel, boolean>>): Promise<void> {
  await setSetting(K_MUTES, JSON.stringify(m));
}

export function mergeFeedItem(
  feed: InAppNotification[],
  item: Omit<InAppNotification, 'read'> & { read?: boolean }
): InAppNotification[] {
  if (feed.some((f) => f.id === item.id)) return feed;
  const next: InAppNotification = {
    ...item,
    read: item.read ?? false,
    createdAt: item.createdAt ?? Date.now(),
  };
  return [next, ...feed].slice(0, MAX_FEED);
}
