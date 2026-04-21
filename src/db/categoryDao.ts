// S.P.A.R.K. — Category Data Access Object
import { getDatabase } from './database';
import { Category, CategoryWithChildren } from './schema';
import { sanitizeText } from '../utils/inputValidation';

export const CategoryDao = {
  async getAll(): Promise<Category[]> {
    const db = await getDatabase();
    return db.getAllAsync<Category>('SELECT * FROM categories ORDER BY parent_id, name');
  },

  async getRootCategories(): Promise<Category[]> {
    const db = await getDatabase();
    return db.getAllAsync<Category>(
      'SELECT * FROM categories WHERE parent_id IS NULL ORDER BY name'
    );
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
    const safeIcon = sanitizeText(category.icon || 'tag-outline', 100);
    const safeColor = sanitizeText(category.color || '#7C6BFF', 20);
    const result = await db.runAsync(
      'INSERT INTO categories (name, icon, color, parent_id, is_system) VALUES (?, ?, ?, ?, 0)',
      [safeName, safeIcon, safeColor, category.parent_id ?? null]
    );
    return result.lastInsertRowId;
  },

  async update(id: number, data: Partial<Category>): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.icon !== undefined) { fields.push('icon = ?'); values.push(data.icon); }
    if (data.color !== undefined) { fields.push('color = ?'); values.push(data.color); }
    if (data.parent_id !== undefined) { fields.push('parent_id = ?'); values.push(data.parent_id); }

    if (fields.length > 0) {
      values.push(id);
      await db.runAsync(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);
    }
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
    await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
  },

  async findByName(name: string): Promise<Category | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Category>(
      'SELECT * FROM categories WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [name]
    );
  },
};
