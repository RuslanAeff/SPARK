// S.P.A.R.K. — Category Data Access Object
import { getDatabase } from './database';
import { Category, CategoryWithChildren } from './schema';
import { sanitizeText } from '../utils/inputValidation';
import { nameIdentityKey } from '../utils/searchText';
import { safeCategoryColor, safeCategoryIcon } from '../utils/categoryAppearance';

export const CategoryDao = {
  async getAll(): Promise<Category[]> {
    const db = await getDatabase();
    return db.getAllAsync<Category>('SELECT * FROM categories ORDER BY parent_id, name');
  },

  async getChildren(parentId: number): Promise<Category[]> {
    const db = await getDatabase();
    return db.getAllAsync<Category>(
      'SELECT * FROM categories WHERE parent_id = ? ORDER BY name',
      [parentId]
    );
  },

  async getTree(): Promise<CategoryWithChildren[]> {
    const all = await CategoryDao.getAll();
    const roots = all.filter(c => c.parent_id === null);
    return roots.map(root => ({
      ...root,
      children: all.filter(c => c.parent_id === root.id),
    }));
  },

  async getById(id: number): Promise<Category | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Category>('SELECT * FROM categories WHERE id = ?', [id]);
  },

  async create(category: { name: string; icon?: string; color?: string; parent_id?: number | null }): Promise<number> {
    const db = await getDatabase();
    const safeName = sanitizeText(category.name, 100);
    if (!safeName) throw new Error('Category name cannot be empty');
    const safeIcon = safeCategoryIcon(sanitizeText(category.icon, 100));
    const safeColor = safeCategoryColor(sanitizeText(category.color, 20));
    // BUG-21: aynı üst altında aynı adlı iki kategori yedekte ayırt edilemez ve
    // kullanıcıya da aynı görünür. Büyük/küçük harf ve boşluk farkı sayılmaz.
    // BUG-14: SQLite lower() ASCII dışı harfleri çevirmez; karşılaştırma JS anahtarıyla.
    const siblings = await db.getAllAsync<{ name: string }>(
      'SELECT name FROM categories WHERE parent_id IS ?',
      [category.parent_id ?? null]
    );
    const key = nameIdentityKey(safeName);
    if (siblings.some(sibling => nameIdentityKey(sibling.name) === key)) {
      throw new Error('CATEGORY_NAME_EXISTS');
    }
    const result = await db.runAsync(
      'INSERT INTO categories (name, icon, color, parent_id, is_system) VALUES (?, ?, ?, ?, 0)',
      [safeName, safeIcon, safeColor, category.parent_id ?? null]
    );
    return result.lastInsertRowId;
  },

  async delete(id: number): Promise<void> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ is_system: number }>(
      'SELECT is_system FROM categories WHERE id = ?',
      [id]
    );
    if (row && row.is_system === 1) {
      throw new Error('SYSTEM_CATEGORY_LOCKED');
    }
    // BUG-13: alt kategoriler CASCADE ile silinir; kategori veya alt kategorisi bir
    // harcamada/fiş kaleminde kullanılıyorsa ham FK hatası yerine açık kod döner.
    if ((await CategoryDao.getUsageCount(id)) > 0) throw new Error('CATEGORY_IN_USE');
    await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
  },

  /** Kategori ve alt kategorilerini kullanan harcama + fiş kalemi sayısı. */
  async getUsageCount(id: number): Promise<number> {
    const db = await getDatabase();
    const usage = await db.getFirstAsync<{ n: number }>(
      `SELECT
         (SELECT COUNT(*) FROM expenses
           WHERE category_id IN (SELECT id FROM categories WHERE id = ? OR parent_id = ?))
       + (SELECT COUNT(*) FROM expense_items
           WHERE category_id IN (SELECT id FROM categories WHERE id = ? OR parent_id = ?)) AS n`,
      [id, id, id, id],
    );
    return Number(usage?.n ?? 0);
  },

  /**
   * BUG-13 eki (ürün kararı A): kullanımdaki kategori silinirken harcamaları ve
   * fiş kalemleri sistem "Diğer" kök kategorisine taşınır; tek transaction.
   * Satıcı varsayılanı FK `ON DELETE SET NULL` ile temizlenir, limitler CASCADE ile gider.
   */
  async deleteMovingUsageToOther(id: number): Promise<void> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ is_system: number }>(
      'SELECT is_system FROM categories WHERE id = ?',
      [id],
    );
    if (!row || row.is_system === 1) throw new Error('SYSTEM_CATEGORY_LOCKED');
    const other = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM categories WHERE name = 'Diğer' AND parent_id IS NULL ORDER BY id LIMIT 1",
    );
    if (!other || other.id === id) throw new Error('OTHER_CATEGORY_MISSING');
    const subtree = 'SELECT id FROM categories WHERE id = ? OR parent_id = ?';
    await db.withTransactionAsync(async () => {
      await db.runAsync(`UPDATE expenses SET category_id = ? WHERE category_id IN (${subtree})`, [other.id, id, id]);
      await db.runAsync(`UPDATE expense_items SET category_id = ? WHERE category_id IN (${subtree})`, [other.id, id, id]);
      await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
    });
  },

  async findByName(name: string): Promise<Category | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Category>(
      'SELECT * FROM categories WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [name]
    );
  },
};
