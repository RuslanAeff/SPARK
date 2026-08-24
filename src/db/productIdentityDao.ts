// S.P.A.R.K. — Kalıcı ürün kimliği, alias öğrenimi ve kullanıcı düzeltmeleri
import * as Crypto from 'expo-crypto';

import { getDatabase } from './database';
import type { CanonicalProduct, ProductAlias } from './schema';
import { sanitizeText } from '../utils/inputValidation';
import {
  sanitizeMeasurementUnit,
  type MeasurementUnit,
} from '../utils/measurementUnit';
import { canonicalizeProductLabel } from '../utils/productIdentity';

type Database = Awaited<ReturnType<typeof getDatabase>>;
const STRONG_IDENTITY_HINT_CONFIDENCE = 0.85;

export interface ProductIdentityHint {
  canonical_name?: string | null;
  brand?: string | null;
  product_family?: string | null;
  variant?: string | null;
  package_descriptor?: string | null;
  confidence?: number | null;
}

export interface ProductIdentityResolution {
  canonicalProductId: number;
  canonicalName: string;
  measurementUnit: MeasurementUnit;
  source: 'alias' | 'deterministic' | 'new';
}

export interface CanonicalProductSummary extends CanonicalProduct {
  alias_count: number;
  observation_count: number;
  latest_date: string | null;
  alias_search_text: string | null;
  raw_search_text: string | null;
  translated_search_text: string | null;
  user_label_search_text: string | null;
}

export interface ProductAliasSummary extends ProductAlias {
  observation_count: number;
  example_name: string | null;
}

function optionalText(value: unknown, maxLength = 500): string | null {
  const cleaned = sanitizeText(value, maxLength);
  return cleaned || null;
}

function safeId(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error('INVALID_PRODUCT_ID');
  return parsed;
}

function strongIdentityHint(hint?: ProductIdentityHint | null): ProductIdentityHint | null {
  const confidence = Number(hint?.confidence);
  return Number.isFinite(confidence) && confidence >= STRONG_IDENTITY_HINT_CONFIDENCE
    ? hint ?? null
    : null;
}

function metadataKey(value: unknown): string | null {
  const text = optionalText(value, 500);
  if (!text) return null;
  return canonicalizeProductLabel(text, 'piece').canonicalKey || null;
}

/**
 * Yalnız iki tarafta da güçlü/açık bir nitelik varsa çelişki sayılır. Eksik AI
 * alanı eşleşmeyi engellemez; farklı marka, varyant veya paket ise sessiz merge
 * yerine yeni ürün ve daha sonra kullanıcı kararı üretir.
 */
function hasProtectedMetadataConflict(
  product: CanonicalProduct,
  hint?: ProductIdentityHint | null,
): boolean {
  const strongHint = strongIdentityHint(hint);
  if (!strongHint) return false;
  return [
    [product.brand, strongHint.brand],
    [product.variant, strongHint.variant],
    [product.package_descriptor, strongHint.package_descriptor],
  ].some(([existing, incoming]) => {
    const existingKey = metadataKey(existing);
    const incomingKey = metadataKey(incoming);
    return existingKey != null && incomingKey != null && existingKey !== incomingKey;
  });
}

async function productById(db: Database, id: number): Promise<CanonicalProduct | null> {
  return db.getFirstAsync<CanonicalProduct>(
    `SELECT id, uid, canonical_name, canonical_key, measurement_unit,
            brand, variant, package_descriptor, created_at, updated_at
       FROM canonical_products
      WHERE id = ?`,
    [id],
  );
}

async function insertAlias(
  db: Database,
  productId: number,
  normalizedAlias: string,
  unit: MeasurementUnit,
  source: ProductAlias['source'],
  confidence: number | null,
): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO product_aliases
       (canonical_product_id, normalized_alias, measurement_unit, source, confidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [productId, normalizedAlias, unit, source, confidence, new Date().toISOString()],
  );
  // INSERT OR IGNORE yalnız tekrar denemeyi idempotent yapar; alias başka bir
  // ürüne aitse sessizce devam etmek güvenli değildir. Saklanan sahibi tekrar
  // okuyup çelişkiyi çağıran transaction'a geri fırlatırız.
  const stored = await db.getFirstAsync<{ canonical_product_id: number }>(
    `SELECT canonical_product_id
       FROM product_aliases
      WHERE normalized_alias = ? AND measurement_unit = ?`,
    [normalizedAlias, unit],
  );
  if (!stored || stored.canonical_product_id !== productId) {
    throw new Error('PRODUCT_ALIAS_CONFLICT');
  }
}

async function createCanonicalProduct(
  db: Database,
  input: {
    canonicalName: string;
    canonicalKey: string;
    measurementUnit: MeasurementUnit;
    hint?: ProductIdentityHint | null;
  },
): Promise<CanonicalProduct> {
  const now = new Date().toISOString();
  // AI metadatası yalnız yeni ürünün açıklayıcı alanlarını zenginleştirir.
  // Eşleşme anahtarı ve otomatik birleştirme kararı her zaman yerel kurallardandır.
  // Düşük güvenli model metni kullanıcıya dönük kanonik başlığı da değiştirmez.
  const trustedHint = strongIdentityHint(input.hint);
  const suggestedDisplayName = optionalText(trustedHint?.canonical_name, 500);
  const brand = optionalText(trustedHint?.brand, 200);
  const variant = optionalText(trustedHint?.variant, 300);
  const packageDescriptor = optionalText(trustedHint?.package_descriptor, 200);
  const inserted = await db.runAsync(
    `INSERT INTO canonical_products
       (uid, canonical_name, canonical_key, measurement_unit, brand, variant,
        package_descriptor, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Crypto.randomUUID(),
      suggestedDisplayName ?? input.canonicalName,
      input.canonicalKey,
      input.measurementUnit,
      brand,
      variant,
      packageDescriptor,
      now,
      now,
    ],
  );
  const created = await productById(db, Number(inserted.lastInsertRowId));
  if (!created) throw new Error('PRODUCT_IDENTITY_CREATE_FAILED');
  return created;
}

/**
 * Bir fiş satırını ağ çağrısı olmadan kalıcı ürüne bağlar.
 *
 * Sıra: tam alias -> tek deterministik aday -> yeni ürün. Aynı kanonik anahtara
 * birden fazla ürün düşerse seçim yapılmaz; yeni ürün oluşturularak kullanıcının
 * daha sonra açıkça birleştirmesi beklenir.
 */
export async function resolveCanonicalProductForItem(
  input: {
    name: string;
    measurementUnit?: MeasurementUnit | string | null;
    hint?: ProductIdentityHint | null;
  },
  database?: Database,
): Promise<ProductIdentityResolution | null> {
  const db = database ?? await getDatabase();
  const identity = canonicalizeProductLabel(input.name, input.measurementUnit);
  if (!identity.canonicalKey || !identity.normalizedAlias || !identity.canonicalName) return null;

  const aliasMatch = await db.getFirstAsync<CanonicalProduct>(
    `SELECT p.id, p.uid, p.canonical_name, p.canonical_key, p.measurement_unit,
            p.brand, p.variant, p.package_descriptor, p.created_at, p.updated_at
       FROM product_aliases a
       JOIN canonical_products p ON p.id = a.canonical_product_id
      WHERE a.normalized_alias = ? AND a.measurement_unit = ?`,
    [identity.normalizedAlias, identity.measurementUnit],
  );
  if (aliasMatch) {
    return {
      canonicalProductId: aliasMatch.id,
      canonicalName: aliasMatch.canonical_name,
      measurementUnit: sanitizeMeasurementUnit(aliasMatch.measurement_unit),
      source: 'alias',
    };
  }

  const deterministicMatches = await db.getAllAsync<CanonicalProduct>(
    `SELECT id, uid, canonical_name, canonical_key, measurement_unit,
            brand, variant, package_descriptor, created_at, updated_at
       FROM canonical_products
      WHERE canonical_key = ? AND measurement_unit = ?
      ORDER BY id ASC
      LIMIT 2`,
    [identity.canonicalKey, identity.measurementUnit],
  );
  if (deterministicMatches.length === 1) {
    const match = deterministicMatches[0];
    if (!hasProtectedMetadataConflict(match, input.hint)) {
      await insertAlias(
        db,
        match.id,
        identity.normalizedAlias,
        identity.measurementUnit,
        'deterministic',
        null,
      );
      return {
        canonicalProductId: match.id,
        canonicalName: match.canonical_name,
        measurementUnit: identity.measurementUnit,
        source: 'deterministic',
      };
    }
  }

  const created = await createCanonicalProduct(db, {
    canonicalName: identity.canonicalName,
    canonicalKey: identity.canonicalKey,
    measurementUnit: identity.measurementUnit,
    hint: input.hint,
  });
  await insertAlias(
    db,
    created.id,
    identity.normalizedAlias,
    identity.measurementUnit,
    // AI yalnız açıklayıcı metadata sağladı; kimlik bağı yerel kuralla kuruldu.
    'deterministic',
    null,
  );
  return {
    canonicalProductId: created.id,
    canonicalName: created.canonical_name,
    measurementUnit: identity.measurementUnit,
    source: 'new',
  };
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export const ProductIdentityDao = {
  async getProductSummaries(): Promise<CanonicalProductSummary[]> {
    const db = await getDatabase();
    return db.getAllAsync<CanonicalProductSummary>(
      `WITH alias_summary AS (
         SELECT canonical_product_id,
                COUNT(*) AS alias_count,
                GROUP_CONCAT(normalized_alias) AS alias_search_text
           FROM product_aliases
          GROUP BY canonical_product_id
       ),
       observation_summary AS (
         SELECT i.canonical_product_id,
                COUNT(*) AS observation_count,
                MAX(e.date) AS latest_date,
                GROUP_CONCAT(DISTINCT NULLIF(TRIM(i.name), '')) AS raw_search_text,
                GROUP_CONCAT(DISTINCT NULLIF(TRIM(i.turkish_name), ''))
                  AS translated_search_text,
                GROUP_CONCAT(DISTINCT NULLIF(TRIM(i.user_label), ''))
                  AS user_label_search_text
           FROM expense_items i
           LEFT JOIN expenses e ON e.id = i.expense_id
          WHERE i.canonical_product_id IS NOT NULL
          GROUP BY i.canonical_product_id
       )
       SELECT p.id, p.uid, p.canonical_name, p.canonical_key, p.measurement_unit,
              p.brand, p.variant, p.package_descriptor, p.created_at, p.updated_at,
              COALESCE(a.alias_count, 0) AS alias_count,
              COALESCE(o.observation_count, 0) AS observation_count,
              o.latest_date,
              a.alias_search_text,
              o.raw_search_text,
              o.translated_search_text,
              o.user_label_search_text
         FROM canonical_products p
         LEFT JOIN alias_summary a ON a.canonical_product_id = p.id
         LEFT JOIN observation_summary o ON o.canonical_product_id = p.id
        ORDER BY observation_count DESC, p.canonical_name COLLATE NOCASE ASC, p.id ASC`,
    );
  },

  async getAliases(productId: number): Promise<ProductAliasSummary[]> {
    const id = safeId(productId);
    const db = await getDatabase();
    const aliases = await db.getAllAsync<ProductAlias>(
      `SELECT id, canonical_product_id, normalized_alias, measurement_unit,
              source, confidence, created_at
         FROM product_aliases
        WHERE canonical_product_id = ?
        ORDER BY created_at ASC, id ASC`,
      [id],
    );
    const items = await db.getAllAsync<{
      name: string;
      measurement_unit: MeasurementUnit;
    }>(
      `SELECT name, measurement_unit
         FROM expense_items
        WHERE canonical_product_id = ?
        ORDER BY id ASC`,
      [id],
    );
    const observationsByAlias = new Map<string, {
      count: number;
      exampleName: string;
    }>();
    for (const item of items) {
      const identity = canonicalizeProductLabel(item.name, item.measurement_unit);
      if (!identity.normalizedAlias) continue;
      const key = `${identity.measurementUnit}\u0000${identity.normalizedAlias}`;
      const current = observationsByAlias.get(key);
      observationsByAlias.set(key, {
        count: (current?.count ?? 0) + 1,
        // Sorgu id ASC olduğu için son yazılan değer eski davranıştaki `.at(-1)`dir.
        exampleName: item.name,
      });
    }
    return aliases.map(alias => {
      const key = `${sanitizeMeasurementUnit(alias.measurement_unit)}\u0000${alias.normalized_alias}`;
      const observations = observationsByAlias.get(key);
      return {
        ...alias,
        observation_count: observations?.count ?? 0,
        example_name: observations?.exampleName ?? null,
      };
    });
  },

  async renameProduct(productId: number, preferredName: string): Promise<void> {
    const id = safeId(productId);
    const safeName = sanitizeText(preferredName, 500);
    if (!safeName) throw new Error('INVALID_PRODUCT_NAME');
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE canonical_products SET canonical_name = ?, updated_at = ? WHERE id = ?',
      [safeName, new Date().toISOString(), id],
    );
  },

  /** Kaynak ürünü hedef ürüne taşır; hiçbir fiş satırı veya fiyat gözlemi silinmez. */
  async mergeProducts(sourceProductId: number, targetProductId: number): Promise<void> {
    const sourceId = safeId(sourceProductId);
    const targetId = safeId(targetProductId);
    if (sourceId === targetId) throw new Error('SAME_PRODUCT_ID');
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      // Aynı SQLite bağlantısındaki sorgular ADR-002 uyarınca seri yürütülür.
      const source = await productById(db, sourceId);
      const target = await productById(db, targetId);
      if (!source || !target) throw new Error('PRODUCT_NOT_FOUND');
      if (
        sanitizeMeasurementUnit(source.measurement_unit)
        !== sanitizeMeasurementUnit(target.measurement_unit)
      ) {
        throw new Error('PRODUCT_UNIT_MISMATCH');
      }

      await db.runAsync(
        `UPDATE product_aliases
            SET canonical_product_id = ?, source = 'user', confidence = 1
          WHERE canonical_product_id = ?`,
        [targetId, sourceId],
      );
      await db.runAsync(
        'UPDATE expense_items SET canonical_product_id = ? WHERE canonical_product_id = ?',
        [targetId, sourceId],
      );
      await db.runAsync(
        'UPDATE canonical_products SET updated_at = ? WHERE id = ?',
        [new Date().toISOString(), targetId],
      );
      await db.runAsync('DELETE FROM canonical_products WHERE id = ?', [sourceId]);
    });
  },

  /**
   * Öğrenilmiş tek aliası yeni ürüne ayırır. İlgili geçmiş satırlar yeni kimliğe
   * bağlanır; tutar, tarih, ham ad ve fiyat alanlarına dokunulmaz.
   */
  async splitAlias(aliasId: number): Promise<number> {
    const safeAliasId = safeId(aliasId);
    const db = await getDatabase();
    let newProductId = 0;
    await db.withTransactionAsync(async () => {
      const alias = await db.getFirstAsync<ProductAlias>(
        `SELECT id, canonical_product_id, normalized_alias, measurement_unit,
                source, confidence, created_at
           FROM product_aliases
          WHERE id = ?`,
        [safeAliasId],
      );
      if (!alias) throw new Error('PRODUCT_ALIAS_NOT_FOUND');
      const source = await productById(db, alias.canonical_product_id);
      if (!source) throw new Error('PRODUCT_NOT_FOUND');

      const rows = await db.getAllAsync<{
        id: number;
        name: string;
        measurement_unit: MeasurementUnit;
      }>(
        `SELECT id, name, measurement_unit
           FROM expense_items
          WHERE canonical_product_id = ?
          ORDER BY id ASC`,
        [source.id],
      );
      const matchingRows = rows.filter(row => (
        canonicalizeProductLabel(row.name, row.measurement_unit).normalizedAlias
          === alias.normalized_alias
      ));
      const representativeName = matchingRows.at(-1)?.name ?? alias.normalized_alias;
      const identity = canonicalizeProductLabel(representativeName, alias.measurement_unit);
      if (!identity.canonicalName || !identity.canonicalKey) throw new Error('INVALID_PRODUCT_NAME');

      const created = await createCanonicalProduct(db, {
        canonicalName: identity.canonicalName,
        canonicalKey: identity.canonicalKey,
        measurementUnit: sanitizeMeasurementUnit(alias.measurement_unit),
      });
      newProductId = created.id;
      await db.runAsync(
        `UPDATE product_aliases
            SET canonical_product_id = ?, source = 'user', confidence = 1
          WHERE id = ?`,
        [created.id, alias.id],
      );

      for (const ids of chunk(matchingRows.map(row => row.id), 400)) {
        if (ids.length === 0) continue;
        const placeholders = ids.map(() => '?').join(',');
        await db.runAsync(
          `UPDATE expense_items SET canonical_product_id = ? WHERE id IN (${placeholders})`,
          [created.id, ...ids],
        );
      }
      await db.runAsync(
        'UPDATE canonical_products SET updated_at = ? WHERE id IN (?, ?)',
        [new Date().toISOString(), source.id, created.id],
      );
      await db.runAsync(
        `DELETE FROM canonical_products
          WHERE id = ?
            AND NOT EXISTS (
              SELECT 1 FROM product_aliases WHERE canonical_product_id = ?
            )
            AND NOT EXISTS (
              SELECT 1 FROM expense_items WHERE canonical_product_id = ?
            )`,
        [source.id, source.id, source.id],
      );
    });
    return newProductId;
  },
};
