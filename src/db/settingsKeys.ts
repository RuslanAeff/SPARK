// S.P.A.R.K. — `settings` tablosu anahtarlarının tek listesi (UI denetimi CQ-03)
//
// Anahtarlar eskiden 14 dosyada ayrı ayrı yazılmış metinlerdi; bir yazım hatası
// sessizce yeni, boş bir ayar yaratırdı. `SettingsDao` artık yalnız bu listedeki
// anahtarları kabul eder (TypeScript derlemede yakalar). Veri sıfırlama da
// silinecek bildirim durumunu buradan okur.
//
// DİKKAT: Değerler kullanıcının cihazındaki kayıtlı anahtarlardır; bir metni
// değiştirmek o ayarı "kaybetmek" demektir. Yeni anahtar eklenebilir, mevcut
// metin değiştirilmez.
export const SETTINGS_KEYS = {
  // ── Kullanıcı tercihleri ──
  language: 'app_language',
  displayCurrency: 'display_currency',
  onboardingCompleted: 'onboarding_completed',
  analyticsCardOrder: 'analytics_card_order',
  budgetCycleStartDay: 'budget_cycle_start_day',
  goalFeatureEnabled: 'goal_feature_enabled',
  goalDashboardFocusEnabled: 'goal_dashboard_focus_enabled',
  themeAutoSchedule: 'auto_theme_schedule',
  themeManual: 'theme_manual',
  themeAccent: 'theme_accent',

  // ── Yedekleme bilgisi ──
  backupLastAt: 'backup_last_at',
  backupLastFullAt: 'backup_last_full_at',
  backupLastCount: 'backup_last_count',
  backupLastItemCount: 'backup_last_item_count',
  backupLastRangeStart: 'backup_last_range_start',
  backupLastRangeEnd: 'backup_last_range_end',
  backupReminderInterval: 'backup_reminder_interval',

  // ── Bildirim durumu ──
  notificationFeed: 'notif_feed_v1',
  notificationRules: 'notif_rules_state_v1',
  notificationMutes: 'notif_mutes_v1',
  notificationAndroidDelivery: 'notif_android_delivery_v1',
  notificationAndroidReminderSchedule: 'notif_android_reminder_schedule_v1',

  // ── Eski sürümden kalan (yalnız taşıma ve silme için) ──
  legacyGeminiApiKey: 'gemini_api_key',

  // ── Tek seferlik veritabanı göçü işaretleri ──
  migrationReceiptMoneyPrecision: 'migration_receipt_money_precision_v1',
  migrationItemMeasurementUnit: 'migration_item_measurement_unit_v1',
  migrationBudgetPeriodSnapshot: 'migration_budget_period_snapshot_v1',
  migrationPaymentReminders: 'migration_payment_reminders_v1',
  migrationPaymentReminderVendorDetach: 'migration_payment_reminder_vendor_detach_v2',
  migrationProductIdentity: 'migration_product_identity_v1',
  migrationContainerDeposit: 'migration_container_deposit_v1',
  migrationVoucherExpiryRepair: 'migration_voucher_expiry_repair_v1',
  migrationCategoryLimitCycle: 'migration_category_limit_cycle_v1',
} as const;

export type SettingKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

/**
 * Silinen borç/plan kayıtlarına atıfta bulunan bildirim durumu. Veri
 * sıfırlamada feed ve kural durumu temizlenir; sessize alma tercihleri
 * kullanıcı tercihidir, korunur.
 */
export const NOTIFICATION_STATE_KEYS: readonly SettingKey[] = [
  SETTINGS_KEYS.notificationFeed,
  SETTINGS_KEYS.notificationRules,
];
