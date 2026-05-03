// S.P.A.R.K. — Database Schema Definitions
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
    quantity    REAL DEFAULT 1,
    unit_price  REAL NOT NULL,
    total_price REAL NOT NULL,
    category_id INTEGER REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    monthly_amount  REAL NOT NULL,
    currency        TEXT DEFAULT 'PLN',
    start_date      TEXT NOT NULL,
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
  quantity: number;
  unit_price: number;
  total_price: number;
  category_id: number | null;
  /** Satır indirimi (pozitif tutar) */
  line_discount?: number | null;
  /** İndirim öncesi satır toplamı */
  list_line_total_before_discount?: number | null;
}

export interface Budget {
  id: number;
  monthly_amount: number;
  currency: string;
  start_date: string;
  active: number;
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
