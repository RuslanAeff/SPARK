// S.P.A.R.K. — Vendor Data Access Object
import { getDatabase } from './database';
import { Vendor } from './schema';
import { sanitizeText } from '../utils/inputValidation';

export const VendorDao = {
  async getAll(): Promise<Vendor[]> {
    const db = await getDatabase();
    return db.getAllAsync<Vendor>('SELECT * FROM vendors ORDER BY name');
  },

  async getById(id: number): Promise<Vendor | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Vendor>('SELECT * FROM vendors WHERE id = ?', [id]);
  },

  async findByName(name: string): Promise<Vendor | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Vendor>(
      'SELECT * FROM vendors WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [name]
    );
  },

  async create(vendor: {
    name: string;
    logo_uri?: string | null;
    default_category_id?: number | null;
  }): Promise<number> {
    const db = await getDatabase();
    const safeName = sanitizeText(vendor.name, 200);
    if (!safeName) throw new Error('Vendor name cannot be empty');
    const result = await db.runAsync(
      'INSERT INTO vendors (name, logo_uri, default_category_id) VALUES (?, ?, ?)',
      [safeName, vendor.logo_uri || null, vendor.default_category_id ?? null]
    );
    return result.lastInsertRowId;
  },

  async findOrCreate(
    name: string,
    opts?: { defaultCategoryId?: number | null }
  ): Promise<number> {
    const safeName = sanitizeText(name, 200);
    if (!safeName) throw new Error('Vendor name cannot be empty');
    const existing = await VendorDao.findByName(safeName);
    if (existing) return existing.id;
    return VendorDao.create({
      name: safeName,
      default_category_id: opts?.defaultCategoryId ?? null,
    });
  },

  async updateLogo(id: number, logoUri: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE vendors SET logo_uri = ? WHERE id = ?', [logoUri, id]);
  },

  /** Satıcı için varsayılan kategoriyi günceller. `null` geçilirse varsayılan
   *  temizlenir. Kategori silinirse FK ON DELETE SET NULL otomatik temizler. */
  async setDefaultCategory(id: number, categoryId: number | null): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE vendors SET default_category_id = ? WHERE id = ?', [
      categoryId,
      id,
    ]);
  },

  async countExpenses(vendorId: number): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) as c FROM expenses WHERE vendor_id = ?',
      [vendorId]
    );
    return row?.c ?? 0;
  },

  /**
   * Satıcıyı ve bu satıcıya bağlı tüm harcamaları atomik olarak siler.
   * P6: Transaction içinde — yarıda kalma riski yok.
   */
  async delete(id: number): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM expenses WHERE vendor_id = ?', [id]);
      await db.runAsync('DELETE FROM vendors WHERE id = ?', [id]);
    });
  },
};
