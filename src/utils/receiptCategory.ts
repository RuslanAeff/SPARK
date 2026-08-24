// S.P.A.R.K. — Fiş kategori sözleşmesi
//
// Gemini ve DB arasında dil bağımsız bir anahtar kullanılır. Kullanıcıya görünen
// kategori adı ise mevcut kanonik Türkçe DB adı üzerinden `tc(...)` ile çevrilir.

export const RECEIPT_CATEGORY_NAMES = {
  market: 'Market',
  corner_shop: 'Bakkal',
  restaurant: 'Restoran',
  fast_food: 'Fast Food',
  cafe: 'Kafe',
  dessert: 'Tatlı',
  beverage: 'İçecek',
  public_transport: 'Toplu Taşıma',
  taxi: 'Taksi',
  fuel: 'Yakıt',
  parking: 'Otopark',
  toll: 'Otoyol / Köprü',
  clothing: 'Giyim',
  electronics: 'Elektronik',
  home_goods: 'Ev Eşyası',
  cosmetics: 'Kozmetik',
  hobby: 'Hobi',
  cinema: 'Sinema',
  games: 'Oyun',
  sports: 'Spor',
  events: 'Konser / Etkinlik',
  digital_subscription: 'Dijital Abonelik',
  electricity: 'Elektrik',
  water: 'Su',
  internet: 'İnternet',
  phone: 'Telefon',
  natural_gas: 'Doğalgaz',
  tv_broadcast: 'TV / Yayın',
  membership: 'Üyelik',
  medicine: 'İlaç',
  doctor: 'Doktor',
  dental: 'Diş',
  hospital: 'Hastane',
  medical_supplies: 'Medikal Ürün & Cihaz',
  books: 'Kitap',
  course: 'Kurs',
  school: 'Okul / Üniversite',
  online_education: 'Online Eğitim',
  rent: 'Ev Kirası',
  dues: 'Aidat',
  mortgage: 'Konut Kredisi',
  home_insurance: 'Ev Sigortası',
  furniture: 'Mobilya & Dekorasyon',
  home_maintenance: 'Tadilat & Bakım',
  garden: 'Bahçe / Peyzaj',
  other: 'Diğer',
} as const;

export type ReceiptCategoryKey = keyof typeof RECEIPT_CATEGORY_NAMES;

export const RECEIPT_CATEGORY_KEYS = Object.keys(
  RECEIPT_CATEGORY_NAMES,
) as ReceiptCategoryKey[];

const VALID_KEYS = new Set<string>(RECEIPT_CATEGORY_KEYS);

function normalizeAlias(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ə/g, 'e')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const CATEGORY_ALIASES: Record<string, ReceiptCategoryKey> = {};

function addAliases(key: ReceiptCategoryKey, ...values: string[]): void {
  CATEGORY_ALIASES[normalizeAlias(key)] = key;
  CATEGORY_ALIASES[normalizeAlias(RECEIPT_CATEGORY_NAMES[key])] = key;
  for (const value of values) CATEGORY_ALIASES[normalizeAlias(value)] = key;
}

addAliases('market', 'süpermarket', 'supermarket', 'grocery', 'groceries', 'ərzaq', 'продукты', 'продуктовый магазин');
addAliases('corner_shop', 'corner shop', 'convenience store', 'baqqal', 'лавка', 'магазин у дома');
addAliases('restaurant', 'restaurant', 'restoran', 'ресторан');
addAliases('fast_food', 'fastfood', 'fast food', 'фастфуд', 'фаст фуд');
addAliases('cafe', 'cafe', 'coffee shop', 'kafe', 'кафе', 'кофейня');
addAliases('dessert', 'sweet', 'sweets', 'şirniyyat', 'десерт', 'сладости');
addAliases('beverage', 'drink', 'drinks', 'içki', 'напиток', 'напитки');
addAliases('public_transport', 'public transport', 'ictimai nəqliyyat', 'общественный транспорт');
addAliases('taxi', 'taksi', 'такси');
addAliases('fuel', 'gas', 'petrol', 'yanacaq', 'топливо', 'бензин');
addAliases('parking', 'park', 'парковка');
addAliases('toll', 'highway', 'bridge toll', 'ödənişli yol', 'платная дорога');
addAliases('clothing', 'clothes', 'geyim', 'одежда');
addAliases('electronics', 'electronic', 'elektronika', 'электроника');
addAliases('home_goods', 'home', 'household', 'ev əşyaları', 'товары для дома');
addAliases('cosmetics', 'cosmetic', 'kosmetika', 'косметика');
addAliases('hobby', 'hobbi', 'хобби');
addAliases('cinema', 'movie', 'kino', 'кино');
addAliases('games', 'game', 'oyun', 'игры');
addAliases('sports', 'sport', 'idman', 'спорт');
addAliases('events', 'concert', 'event', 'konsert', 'мероприятие', 'концерт');
addAliases('digital_subscription', 'digital subscription', 'rəqəmsal abunə', 'цифровая подписка');
addAliases('electricity', 'electric', 'elektrik', 'электричество');
addAliases('water', 'su', 'вода');
addAliases('internet', 'интернет');
addAliases('phone', 'telephone', 'telefon', 'телефон');
addAliases('natural_gas', 'natural gas', 'gas bill', 'təbii qaz', 'природный газ');
addAliases('tv_broadcast', 'tv', 'television', 'телевидение');
addAliases('membership', 'subscription', 'üzvlük', 'членство', 'подписка');
addAliases('medicine', 'pharmacy', 'drug', 'dərman', 'лекарство', 'аптека');
addAliases('doctor', 'həkim', 'врач');
addAliases('dental', 'dentist', 'diş həkimi', 'стоматолог');
addAliases('hospital', 'xəstəxana', 'больница');
addAliases('medical_supplies', 'medical supplies', 'medical device', 'tibbi məhsul', 'медтовары');
addAliases('books', 'book', 'kitab', 'книги');
addAliases('course', 'kurs', 'курс');
addAliases('school', 'university', 'məktəb', 'universitet', 'школа', 'университет');
addAliases('online_education', 'online education', 'onlayn təhsil', 'онлайн обучение');
addAliases('rent', 'house rent', 'kirayə', 'аренда');
addAliases('dues', 'maintenance fee', 'aidat', 'взнос');
addAliases('mortgage', 'home loan', 'ipoteka', 'ипотека');
addAliases('home_insurance', 'home insurance', 'ev sığortası', 'страхование жилья');
addAliases('furniture', 'furniture decoration', 'mebel', 'мебель');
addAliases('home_maintenance', 'repair maintenance', 'təmir', 'ремонт');
addAliases('garden', 'garden landscaping', 'bağ', 'сад');
addAliases('other', 'other', 'digər', 'прочее', 'другое');

export function normalizeReceiptCategoryKey(
  categoryKey: unknown,
  legacyCategory?: unknown,
): ReceiptCategoryKey {
  const direct = normalizeAlias(categoryKey).replace(/ /g, '_');
  if (VALID_KEYS.has(direct)) return direct as ReceiptCategoryKey;

  for (const candidate of [categoryKey, legacyCategory]) {
    const normalized = normalizeAlias(candidate);
    if (CATEGORY_ALIASES[normalized]) return CATEGORY_ALIASES[normalized];
  }
  return 'other';
}

export function canonicalReceiptCategoryName(
  categoryKey: unknown,
  legacyCategory?: unknown,
): string {
  return RECEIPT_CATEGORY_NAMES[
    normalizeReceiptCategoryKey(categoryKey, legacyCategory)
  ];
}
