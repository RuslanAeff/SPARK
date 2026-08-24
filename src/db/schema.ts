// S.P.A.R.K. — Database Schema Definitions

/** Kanonik ürün ve öğrenilmiş alias tabloları; eski/yeni DB'de idempotenttir. */
export const PRODUCT_IDENTITY_TABLES_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS canonical_products (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    uid                 TEXT NOT NULL UNIQUE CHECK(length(uid) = 36),
    canonical_name      TEXT NOT NULL CHECK(length(trim(canonical_name)) BETWEEN 1 AND 500),
    canonical_key       TEXT NOT NULL CHECK(length(trim(canonical_key)) BETWEEN 1 AND 500),
    measurement_unit    TEXT NOT NULL CHECK(measurement_unit IN ('piece', 'kg', 'l')),
    brand               TEXT,
    variant             TEXT,
    package_descriptor  TEXT,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS product_aliases (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    canonical_product_id  INTEGER NOT NULL REFERENCES canonical_products(id) ON DELETE CASCADE,
    normalized_alias      TEXT NOT NULL CHECK(length(trim(normalized_alias)) BETWEEN 1 AND 500),
    measurement_unit      TEXT NOT NULL CHECK(measurement_unit IN ('piece', 'kg', 'l')),
    source                TEXT NOT NULL CHECK(source IN ('deterministic', 'ai', 'user')),
    confidence            REAL CHECK(confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    created_at            TEXT NOT NULL,
    UNIQUE(normalized_alias, measurement_unit)
  );

  CREATE INDEX IF NOT EXISTS idx_canonical_products_match
    ON canonical_products(canonical_key, measurement_unit);
  CREATE INDEX IF NOT EXISTS idx_product_aliases_product
    ON product_aliases(canonical_product_id);
`;

export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    icon        TEXT DEFAULT 'tag-outline',
    color       TEXT DEFAULT '#7C6BFF',
    parent_id   INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vendors (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT NOT NULL,
    logo_uri            TEXT,
    default_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  -- Fişteki ham ad değişmeden kalır; analiz kimliği bu taşınabilir UUID'li
  -- kanonik ürün üzerinden kurulur. canonical_key otomatik eşleştirme için
  -- yerel ve deterministik anahtardır, kullanıcıya gösterilen ad değildir.
  ${PRODUCT_IDENTITY_TABLES_SCHEMA_SQL}

  CREATE TABLE IF NOT EXISTS expenses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id    INTEGER REFERENCES vendors(id),
    category_id  INTEGER REFERENCES categories(id),
    total_amount REAL NOT NULL,
    currency     TEXT DEFAULT 'PLN',
    note         TEXT,
    receipt_uri  TEXT,
    date         TEXT NOT NULL,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS expense_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id  INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    turkish_name TEXT,
    user_label  TEXT CHECK(user_label IS NULL OR length(user_label) <= 500),
    quantity    REAL DEFAULT 1,
    measurement_unit TEXT NOT NULL DEFAULT 'piece' CHECK(measurement_unit IN ('piece', 'kg', 'l')),
    canonical_product_id INTEGER REFERENCES canonical_products(id) ON DELETE SET NULL,
    unit_price  REAL NOT NULL,
    total_price REAL NOT NULL,
    category_id INTEGER REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    monthly_amount  REAL NOT NULL,
    currency        TEXT DEFAULT 'PLN',
    start_date      TEXT NOT NULL,
    period_start    TEXT,
    period_end      TEXT,
    cycle_start_day INTEGER,
    active          INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
  CREATE INDEX IF NOT EXISTS idx_expenses_vendor ON expenses(vendor_id);
  CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
  CREATE INDEX IF NOT EXISTS idx_expense_items_expense ON expense_items(expense_id);
  CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
  CREATE INDEX IF NOT EXISTS idx_budgets_active ON budgets(active);

  CREATE TABLE IF NOT EXISTS savings_goal (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    title TEXT NOT NULL DEFAULT '',
    target_amount REAL NOT NULL DEFAULT 0,
    target_date TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'PLN',
    current_amount REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS category_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    limit_amount REAL NOT NULL,
    UNIQUE(category_id, month)
  );

  CREATE INDEX IF NOT EXISTS idx_category_limits_month ON category_limits(month);

  -- Tekrar eden ödeme (abonelik) tespitinin sonuçları. Kayıtlar
  -- syncSubscriptions() tarafından expenses tablosundan üretilir; kullanıcının
  -- "abonelik değil" tepkisi (status='dismissed') burada saklanır ve aynı
  -- vendor_id için bir daha aktif öneri çıkarılmaz.
  CREATE TABLE IF NOT EXISTS subscriptions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id           INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    amount              REAL NOT NULL,
    currency            TEXT NOT NULL,
    period_days         INTEGER NOT NULL,
    last_seen_date      TEXT NOT NULL,
    next_expected_date  TEXT NOT NULL,
    occurrences         INTEGER NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'active',
    updated_at          TEXT NOT NULL,
    UNIQUE(vendor_id)
  );
  CREATE INDEX IF NOT EXISTS idx_subscriptions_vendor ON subscriptions(vendor_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_next ON subscriptions(next_expected_date);

  -- Borç Operasyonu (§ debt). Borç alma/verme, fiş bütünlüğünü BOZMADAN ayrı
  -- izlenir: harcama/fiş her zaman bütündür, geri ödeme tüketim SAYILMAZ. Bütçe
  -- etkisi nakit-akışı modelidir (borç alınan döngüde +, ödenen döngüde −) →
  -- src/utils/debtMath.ts. 'remaining' kalan borç; <=0 olunca status='settled'.
  CREATE TABLE IF NOT EXISTS debts (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    direction         TEXT NOT NULL DEFAULT 'borrowed',   -- 'borrowed'=ben aldım | 'lent'=ben verdim
    counterparty      TEXT NOT NULL DEFAULT '',
    amount            REAL NOT NULL,                       -- orijinal tutar (>0)
    remaining         REAL NOT NULL,                       -- kalan; <=0 → settled
    currency          TEXT NOT NULL DEFAULT 'PLN',
    date              TEXT NOT NULL,                       -- YYYY-MM-DD (döngü bundan hesaplanır)
    status            TEXT NOT NULL DEFAULT 'open',        -- 'open' | 'settled'
    due_date          TEXT,
    reminder_enabled  INTEGER NOT NULL DEFAULT 0 CHECK(
      reminder_enabled IN (0, 1)
      AND (reminder_enabled = 0 OR due_date IS NOT NULL)
    ),
    reminder_days_before INTEGER NOT NULL DEFAULT 3 CHECK(reminder_days_before BETWEEN 0 AND 365),
    reminder_time     TEXT NOT NULL DEFAULT '09:00' CHECK(
      length(reminder_time) = 5
      AND substr(reminder_time, 3, 1) = ':'
      AND substr(reminder_time, 1, 2) GLOB '[0-2][0-9]'
      AND CAST(substr(reminder_time, 1, 2) AS INTEGER) BETWEEN 0 AND 23
      AND substr(reminder_time, 4, 2) GLOB '[0-5][0-9]'
    ),
    linked_expense_id INTEGER REFERENCES expenses(id) ON DELETE SET NULL,
    note              TEXT,
    created_at        TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
  CREATE INDEX IF NOT EXISTS idx_debts_date ON debts(date);

  CREATE TABLE IF NOT EXISTS debt_payments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    debt_id     INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    amount      REAL NOT NULL,
    date        TEXT NOT NULL,                             -- ödeme günü (döngü bundan)
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);
  CREATE INDEX IF NOT EXISTS idx_debt_payments_date ON debt_payments(date);

  CREATE TABLE IF NOT EXISTS extra_incomes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source      TEXT NOT NULL DEFAULT '',            -- "Credit Agricole bonus", "Ek iş" ...
    amount      REAL NOT NULL,                        -- >0 (harcanabilir tutarı ARTIRIR)
    currency    TEXT NOT NULL DEFAULT 'PLN',
    date        TEXT NOT NULL,                        -- YYYY-MM-DD (döngü bundan hesaplanır)
    note        TEXT,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_extra_incomes_date ON extra_incomes(date);
`;

/**
 * `expense_items.canonical_product_id` eski kurulumlarda ALTER TABLE ile
 * eklendikten sonra kurulması gereken indeks ve çapraz-birim korumaları.
 * CREATE_TABLES_SQL içine alınmaz: CREATE TABLE IF NOT EXISTS eski tabloya yeni
 * kolon eklemez ve trigger oluşturma aşamasında açılışı kırardı.
 */
export const PRODUCT_IDENTITY_LINKS_SCHEMA_SQL = `
  CREATE INDEX IF NOT EXISTS idx_expense_items_canonical_product
    ON expense_items(canonical_product_id);

  CREATE TRIGGER IF NOT EXISTS trg_expense_item_canonical_unit_insert
    BEFORE INSERT ON expense_items
    FOR EACH ROW
    WHEN NEW.canonical_product_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM canonical_products p
         WHERE p.id = NEW.canonical_product_id
           AND p.measurement_unit = NEW.measurement_unit
      )
  BEGIN
    SELECT RAISE(ABORT, 'CANONICAL_PRODUCT_UNIT_MISMATCH');
  END;

  CREATE TRIGGER IF NOT EXISTS trg_expense_item_canonical_unit_update
    BEFORE UPDATE OF canonical_product_id, measurement_unit ON expense_items
    FOR EACH ROW
    WHEN NEW.canonical_product_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM canonical_products p
         WHERE p.id = NEW.canonical_product_id
           AND p.measurement_unit = NEW.measurement_unit
      )
  BEGIN
    SELECT RAISE(ABORT, 'CANONICAL_PRODUCT_UNIT_MISMATCH');
  END;

  CREATE TRIGGER IF NOT EXISTS trg_product_alias_canonical_unit_insert
    BEFORE INSERT ON product_aliases
    FOR EACH ROW
    WHEN NOT EXISTS (
      SELECT 1 FROM canonical_products p
       WHERE p.id = NEW.canonical_product_id
         AND p.measurement_unit = NEW.measurement_unit
    )
  BEGIN
    SELECT RAISE(ABORT, 'CANONICAL_PRODUCT_UNIT_MISMATCH');
  END;

  CREATE TRIGGER IF NOT EXISTS trg_product_alias_canonical_unit_update
    BEFORE UPDATE OF canonical_product_id, measurement_unit ON product_aliases
    FOR EACH ROW
    WHEN NOT EXISTS (
      SELECT 1 FROM canonical_products p
       WHERE p.id = NEW.canonical_product_id
         AND p.measurement_unit = NEW.measurement_unit
    )
  BEGIN
    SELECT RAISE(ABORT, 'CANONICAL_PRODUCT_UNIT_MISMATCH');
  END;

  CREATE TRIGGER IF NOT EXISTS trg_canonical_product_unit_immutable
    BEFORE UPDATE OF measurement_unit ON canonical_products
    FOR EACH ROW
    WHEN NEW.measurement_unit <> OLD.measurement_unit
      AND (
        EXISTS (SELECT 1 FROM expense_items i WHERE i.canonical_product_id = OLD.id)
        OR EXISTS (SELECT 1 FROM product_aliases a WHERE a.canonical_product_id = OLD.id)
      )
  BEGIN
    SELECT RAISE(ABORT, 'CANONICAL_PRODUCT_UNIT_IMMUTABLE');
  END;
`;

/**
 * Borç vadesi indeksini ve kullanıcı tarafından onaylanmış düzenli ödeme
 * hatırlatıcılarını kurar. Bu SQL, eski `debts` tablolarına kolonlar eklendikten
 * sonra çalıştırılmalıdır; bu yüzden CREATE_TABLES_SQL içine gömülmez.
 */
export const PAYMENT_REMINDERS_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS recurring_payment_reminders (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    uid                   TEXT NOT NULL UNIQUE,
    title                 TEXT NOT NULL,
    vendor_id             INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
    expected_amount       REAL CHECK(expected_amount IS NULL OR expected_amount >= 0),
    currency              TEXT NOT NULL DEFAULT 'PLN',
    anchor_date           TEXT NOT NULL,
    next_due_date         TEXT NOT NULL CHECK(next_due_date >= anchor_date),
    recurrence_unit       TEXT NOT NULL CHECK(recurrence_unit IN ('day', 'week', 'month', 'year')),
    recurrence_interval   INTEGER NOT NULL DEFAULT 1 CHECK(recurrence_interval BETWEEN 1 AND 999),
    reminder_days_before  INTEGER NOT NULL DEFAULT 3 CHECK(reminder_days_before BETWEEN 0 AND 365),
    reminder_time         TEXT NOT NULL DEFAULT '09:00' CHECK(
      length(reminder_time) = 5
      AND substr(reminder_time, 3, 1) = ':'
      AND substr(reminder_time, 1, 2) GLOB '[0-2][0-9]'
      AND CAST(substr(reminder_time, 1, 2) AS INTEGER) BETWEEN 0 AND 23
      AND substr(reminder_time, 4, 2) GLOB '[0-5][0-9]'
    ),
    status                TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused')),
    source                TEXT NOT NULL DEFAULT 'manual' CHECK(
      source IN ('manual', 'detected')
      AND (source != 'detected' OR vendor_id IS NOT NULL)
    ),
    note                  TEXT,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL
  );

  -- Kullanıcı satıcı kaydını sildiğinde onaylanmış bir hatırlatıcı sessizce
  -- kaybolmaz. FK vendor_id'yi NULL yapmadan önce kaynak "manual" olarak
  -- ayrıştırılır; böylece detected=>vendor değişmezi ve ON DELETE SET NULL
  -- birlikte güvenle çalışır.
  CREATE TRIGGER IF NOT EXISTS trg_recurring_reminder_vendor_detach
    BEFORE DELETE ON vendors
    FOR EACH ROW
  BEGIN
    UPDATE recurring_payment_reminders
       SET source = 'manual',
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE vendor_id = OLD.id AND source = 'detected';
  END;

  CREATE INDEX IF NOT EXISTS idx_recurring_payment_reminders_due
    ON recurring_payment_reminders(next_due_date)
    WHERE status = 'active';
  CREATE INDEX IF NOT EXISTS idx_recurring_payment_reminders_vendor
    ON recurring_payment_reminders(vendor_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_recurring_payment_reminders_detected_vendor
    ON recurring_payment_reminders(vendor_id)
    WHERE source = 'detected' AND vendor_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_debts_open_reminder_due
    ON debts(due_date)
    WHERE status = 'open' AND reminder_enabled = 1 AND due_date IS NOT NULL;
`;

export const DEFAULT_CATEGORIES = [
  { name: 'Yeme-İçme', icon: 'food-apple-outline', color: '#FFA654', children: [
    { name: 'Market', icon: 'cart-outline', color: '#FFA654' },
    { name: 'Bakkal', icon: 'storefront-outline', color: '#FF9A4D' },
    { name: 'Restoran', icon: 'silverware-fork-knife', color: '#FF8C42' },
    { name: 'Fast Food', icon: 'hamburger', color: '#FF6B35' },
    { name: 'Kafe', icon: 'coffee-outline', color: '#D4A373' },
    { name: 'Tatlı', icon: 'cupcake', color: '#E8A598' },
    { name: 'İçecek', icon: 'bottle-soda-outline', color: '#FFB38A' },
  ]},
  { name: 'Ulaşım', icon: 'bus', color: '#6C7BFF', children: [
    { name: 'Toplu Taşıma', icon: 'train', color: '#6C7BFF' },
    { name: 'Taksi', icon: 'taxi', color: '#5A68E0' },
    { name: 'Yakıt', icon: 'gas-station-outline', color: '#4855C5' },
    { name: 'Otopark', icon: 'parking', color: '#5D6BDD' },
    { name: 'Otoyol / Köprü', icon: 'road-variant', color: '#4A57C9' },
  ]},
  { name: 'Alışveriş', icon: 'shopping-outline', color: '#FF6B8A', children: [
    { name: 'Giyim', icon: 'tshirt-crew-outline', color: '#FF6B8A' },
    { name: 'Elektronik', icon: 'cellphone', color: '#E05580' },
    { name: 'Ev Eşyası', icon: 'home-outline', color: '#C74070' },
    { name: 'Kozmetik', icon: 'lipstick', color: '#D65A8A' },
    { name: 'Hobi', icon: 'palette-outline', color: '#B84D78' },
  ]},
  { name: 'Eğlence', icon: 'gamepad-variant-outline', color: '#4ECDC4', children: [
    { name: 'Sinema', icon: 'movie-open-outline', color: '#4ECDC4' },
    { name: 'Oyun', icon: 'controller-classic-outline', color: '#3CB8B0' },
    { name: 'Spor', icon: 'dumbbell', color: '#2AA39C' },
    { name: 'Konser / Etkinlik', icon: 'music-note', color: '#38C4B8' },
    { name: 'Dijital Abonelik', icon: 'play-circle-outline', color: '#32B8AC' },
  ]},
  { name: 'Faturalar', icon: 'file-document-outline', color: '#FECA57', children: [
    { name: 'Elektrik', icon: 'flash-outline', color: '#FECA57' },
    { name: 'Su', icon: 'water-outline', color: '#E0B44D' },
    { name: 'İnternet', icon: 'wifi', color: '#C69E43' },
    { name: 'Telefon', icon: 'phone-outline', color: '#AC8839' },
    { name: 'Doğalgaz', icon: 'fire', color: '#D4A843' },
    { name: 'TV / Yayın', icon: 'television-classic', color: '#BE9638' },
    { name: 'Üyelik', icon: 'card-account-details-outline', color: '#A88432' },
  ]},
  { name: 'Sağlık', icon: 'heart-pulse', color: '#2ED573', children: [
    { name: 'İlaç', icon: 'pill', color: '#2ED573' },
    { name: 'Doktor', icon: 'stethoscope', color: '#25B862' },
    { name: 'Diş', icon: 'tooth-outline', color: '#22AD5C' },
    { name: 'Hastane', icon: 'hospital-building', color: '#1FA256' },
    { name: 'Medikal Ürün & Cihaz', icon: 'medical-bag', color: '#1B9650' },
  ]},
  { name: 'Eğitim', icon: 'school-outline', color: '#54A0FF', children: [
    { name: 'Kitap', icon: 'book-open-variant', color: '#54A0FF' },
    { name: 'Kurs', icon: 'certificate-outline', color: '#4590E8' },
    { name: 'Okul / Üniversite', icon: 'notebook', color: '#3E85DC' },
    { name: 'Online Eğitim', icon: 'video-outline', color: '#367AD0' },
  ]},
  { name: 'Konut', icon: 'home-city-outline', color: '#8B7FC8', children: [
    { name: 'Ev Kirası', icon: 'key-variant', color: '#7B6FB8' },
    { name: 'Aidat', icon: 'account-group-outline', color: '#7366AE' },
    { name: 'Konut Kredisi', icon: 'bank-outline', color: '#6B5DA4' },
    { name: 'Ev Sigortası', icon: 'shield-check-outline', color: '#63549A' },
    { name: 'Mobilya & Dekorasyon', icon: 'sofa-outline', color: '#5B4B90' },
    { name: 'Tadilat & Bakım', icon: 'hammer-wrench', color: '#534286' },
    { name: 'Bahçe / Peyzaj', icon: 'flower-outline', color: '#4B397C' },
  ]},
  { name: 'Diğer', icon: 'dots-horizontal-circle-outline', color: '#8B8B9E', children: [] },
];

// Type definitions
export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  parent_id: number | null;
  created_at: string;
  /** 1 = uygulama varsayılanı; silinemez */
  is_system?: number;
}

export interface Vendor {
  id: number;
  name: string;
  logo_uri: string | null;
  /** Bu satıcı için harcama eklenirken otomatik seçilen kategori (yaprak ya da kök).
   *  null ise kullanıcı her seferinde manuel seçer / fiş tarama Gemini önerisini kullanır. */
  default_category_id: number | null;
  created_at: string;
}

/** Tekrar eden ödeme (abonelik) tespiti — `subscriptions` tablosu satırı. */
export interface SubscriptionRow {
  id: number;
  vendor_id: number;
  amount: number;
  currency: string;
  period_days: number;
  last_seen_date: string;
  next_expected_date: string;
  occurrences: number;
  status: 'active' | 'dismissed';
  updated_at: string;
}

/** UI için zenginleştirilmiş abonelik satırı. */
export interface SubscriptionWithDetails extends SubscriptionRow {
  vendor_name: string;
  vendor_logo: string | null;
  category_id: number | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
}

export interface Expense {
  id: number;
  vendor_id: number | null;
  category_id: number | null;
  total_amount: number;
  currency: string;
  note: string | null;
  receipt_uri: string | null;
  date: string;
  created_at: string;
}

export interface ExpenseItem {
  id: number;
  expense_id: number;
  name: string;
  turkish_name?: string | null;
  /** Kullanıcının görünüm düzeltmesi; ham fiş/OCR adlarını değiştirmez. */
  user_label?: string | null;
  quantity: number;
  measurement_unit?: import('../utils/measurementUnit').MeasurementUnit;
  canonical_product_id?: number | null;
  unit_price: number;
  total_price: number;
  category_id: number | null;
  /** Satır indirimi (pozitif tutar) */
  line_discount?: number | null;
  /** İndirim öncesi satır toplamı */
  list_line_total_before_discount?: number | null;
}

export interface CanonicalProduct {
  id: number;
  uid: string;
  canonical_name: string;
  canonical_key: string;
  measurement_unit: import('../utils/measurementUnit').MeasurementUnit;
  brand: string | null;
  variant: string | null;
  package_descriptor: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductAlias {
  id: number;
  canonical_product_id: number;
  normalized_alias: string;
  measurement_unit: import('../utils/measurementUnit').MeasurementUnit;
  source: 'deterministic' | 'ai' | 'user';
  confidence: number | null;
  created_at: string;
}

export interface Budget {
  id: number;
  monthly_amount: number;
  currency: string;
  start_date: string;
  period_start: string | null;
  period_end: string | null;
  cycle_start_day: number | null;
  active: number;
}

/** Borç Operasyonu — `debts` tablosu satırı. v1 UI yalnızca 'borrowed' yönüne
 *  odaklanır; 'lent' (verme) şemada hazır, UI'ı sonraki faz. */
export interface Debt {
  id: number;
  /** 'borrowed' = ben borç aldım | 'lent' = ben borç verdim. */
  direction: 'borrowed' | 'lent';
  /** Kime/kimden (karşı taraf). */
  counterparty: string;
  /** Orijinal borç tutarı (>0). */
  amount: number;
  /** Kalan borç; ödeme yapıldıkça düşer, <=0 → status='settled'. */
  remaining: number;
  currency: string;
  /** YYYY-MM-DD; borcun düştüğü bütçe döngüsü bu tarihten hesaplanır. */
  date: string;
  status: 'open' | 'settled';
  /** Opsiyonel vade tarihi; YYYY-MM-DD. */
  due_date: string | null;
  reminder_enabled: 0 | 1;
  reminder_days_before: number;
  /** Cihazın yerel saatinde HH:MM. */
  reminder_time: string;
  /** Borcun karşıladığı fişe opsiyonel bağ (fiş silinirse SET NULL). */
  linked_expense_id: number | null;
  note: string | null;
  created_at: string;
}

/** Borç Operasyonu — `debt_payments` tablosu satırı (kısmi geri ödeme). */
export interface DebtPayment {
  id: number;
  debt_id: number;
  amount: number;
  /** YYYY-MM-DD; ödemenin düştüğü bütçe döngüsü bu tarihten hesaplanır. */
  date: string;
  created_at: string;
}

export type ReminderRecurrenceUnit = 'day' | 'week' | 'month' | 'year';
export type RecurringPaymentReminderStatus = 'active' | 'paused';
export type RecurringPaymentReminderSource = 'manual' | 'detected';

/** Kullanıcı tarafından onaylanmış düzenli ödeme hatırlatıcısı. */
export interface RecurringPaymentReminder {
  id: number;
  /** Backup/import boyunca değişmeyen uygulama kimliği. */
  uid: string;
  title: string;
  vendor_id: number | null;
  expected_amount: number | null;
  currency: string;
  /** Ay sonu kaymasını engelleyen değişmez tekrar başlangıcı; YYYY-MM-DD. */
  anchor_date: string;
  /** Sıradaki somut oluşum; YYYY-MM-DD. */
  next_due_date: string;
  recurrence_unit: ReminderRecurrenceUnit;
  recurrence_interval: number;
  reminder_days_before: number;
  /** Cihazın yerel saatinde HH:MM. */
  reminder_time: string;
  status: RecurringPaymentReminderStatus;
  source: RecurringPaymentReminderSource;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** Ek Gelir — bütçe dışı, harcanabilir tutarı ARTIRAN nakit girişi (banka bonusu,
 *  hediye, tek seferlik ek iş...). Borçtan farkı: geri ödeme yükümlülüğü YOKTUR →
 *  `remaining`/`status`/ödeme tablosu yok, "açık borç" rozetine girmez. Düştüğü
 *  döngüyü `date` belirler; sonraki döngüye sarkmaz (bkz. src/utils/debtMath.ts). */
export interface ExtraIncome {
  id: number;
  /** Kaynak (banka, kişi, iş) — serbest metin. */
  source: string;
  /** Tutar (>0). */
  amount: number;
  currency: string;
  /** YYYY-MM-DD; gelirin düştüğü bütçe döngüsü bu tarihten hesaplanır. */
  date: string;
  note: string | null;
  created_at: string;
}

// Extended types for UI
export interface ExpenseWithDetails extends Expense {
  vendor_name?: string;
  vendor_logo?: string | null;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  items?: ExpenseItem[];
}

export interface CategoryWithChildren extends Category {
  children: Category[];
}

export interface CategorySpending {
  category_id: number;
  category_name: string;
  category_icon: string;
  category_color: string;
  total: number;
  percentage: number;
}

export interface VendorSpending {
  vendor_id: number;
  vendor_name: string;
  vendor_logo: string | null;
  total: number;
  percentage: number;
}
