import { getSharedDatabase } from '../config/database.js';

export const categoryRepository = {
  findAll({ onlyActive = false } = {}) {
    const db = getSharedDatabase();
    let query = 'SELECT id, name, description, is_active, created_at, updated_at FROM categories';
    if (onlyActive) {
      query += ' WHERE is_active = 1';
    }
    query += ' ORDER BY name ASC';
    return db.prepare(query).all();
  },

  findById(id) {
    const db = getSharedDatabase();
    return db.prepare('SELECT id, name, description, is_active, created_at, updated_at FROM categories WHERE id = ?').get(id) || null;
  },

  findByName(name) {
    const db = getSharedDatabase();
    return db.prepare('SELECT id, name, description, is_active, created_at, updated_at FROM categories WHERE LOWER(name) = LOWER(?)').get(name) || null;
  },

  create({ name, description }) {
    const db = getSharedDatabase();
    const statement = db.prepare(`
      INSERT INTO categories (name, description)
      VALUES (?, ?)
    `);
    const info = statement.run(name, description ?? null);
    return this.findById(info.lastInsertRowid);
  },

  update(id, { name, description, is_active }) {
    const db = getSharedDatabase();
    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      fields.push('description = ?');
      params.push(description);
    }
    if (is_active !== undefined) {
      fields.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    const query = `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...params);
    return this.findById(id);
  },

  delete(id) {
    const db = getSharedDatabase();
    const statement = db.prepare('DELETE FROM categories WHERE id = ?');
    const info = statement.run(id);
    return info.changes > 0;
  },

  countReportsByCategoryId(categoryId) {
    const db = getSharedDatabase();
    const row = db.prepare('SELECT COUNT(*) AS total FROM reports WHERE category_id = ?').get(categoryId);
    return row ? row.total : 0;
  },
};
