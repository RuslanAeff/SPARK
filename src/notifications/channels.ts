import type { NotificationMuteChannel } from './types';

/** Feed kimliğini hem filtre hem native teslim için tek kanonik mute kanalına bağlar. */
export function notificationMuteChannelFromId(id: string): NotificationMuteChannel {
  if (id.startsWith('budget-') || id.startsWith('month-')) return 'budget';
  if (id.startsWith('catlim-')) return 'category_limit';
  if (id.startsWith('goal-')) return 'goal';
  if (id.startsWith('receipt-')) return 'receipt';
  if (id.startsWith('debt-')) return 'debt';
  if (id.startsWith('payplan-due-v1-')) return 'payment_plan';
  if (id.startsWith('sub-')) return 'subscription';
  if (id.startsWith('backup-')) return 'backup';
  return 'system';
}

export function isNotificationMuted(
  id: string,
  mutes: Partial<Record<NotificationMuteChannel, boolean>>,
): boolean {
  return mutes[notificationMuteChannelFromId(id)] === true;
}
