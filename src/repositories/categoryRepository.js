import { getSharedDatabase, queryAll, queryOne } from '../config/database.js';

const CATEGORY_COLUMNS =
  'id, name, description, is_active, created_at, updated_at';

export const categoryRepository = {
  async findAll({ onlyActive = false } = {}) {
    const query = `SELECT ${CATEGORY_COLUMNS} FROM categories${
      onlyActive ? ' WHERE is_active = 1' : ''
    } ORDER BY name ASC`;
    return queryAll(getSharedDatabase(), query);
  },

  async findById(id) {
    return queryOne(
      getSharedDatabase(),
      `SELECT ${CATEGORY_COLUMNS} FROM categories WHERE id = ?`,
      [id],
    );
  },

  async findByName(name) {
    return queryOne(
      getSharedDatabase(),
      `SELECT ${CATEGORY_COLUMNS} FROM categories WHERE LOWER(name) = LOWER(?)`,
      [name],
    );
  },

  async create({ name, description }) {
    const result = await getSharedDatabase().execute({
      sql: 'INSERT INTO categories (name, description) VALUES (?, ?)',
      args: [name, description ?? null],
    });
    return this.findById(Number(result.lastInsertRowid));
  },

  async update(id, { name, description, is_active }) {
    const fields = [];
    const args = [];

    if (name !== undefined) {
      fields.push('name = ?');
      args.push(name);
    }
    if (description !== undefined) {
      fields.push('description = ?');
      args.push(description);
    }
    if (is_active !== undefined) {
      fields.push('is_active = ?');
      args.push(is_active ? 1 : 0);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    args.push(id);
    await getSharedDatabase().execute({
      sql: `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`,
      args,
    });
    return this.findById(id);
  },

  async delete(id) {
    const result = await getSharedDatabase().execute({
      sql: 'DELETE FROM categories WHERE id = ?',
      args: [id],
    });
    return result.rowsAffected > 0;
  },

  async countReportsByCategoryId(categoryId) {
    const row = await queryOne(
      getSharedDatabase(),
      'SELECT COUNT(*) AS total FROM reports WHERE category_id = ?',
      [categoryId],
    );
    return row?.total ?? 0;
  },
};
