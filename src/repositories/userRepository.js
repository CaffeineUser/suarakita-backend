import { getSharedDatabase } from '../config/database.js';

export const userRepository = {
  findById(id) {
    const db = getSharedDatabase();
    const statement = db.prepare(`
      SELECT id, name, email, role, created_at, updated_at
      FROM users
      WHERE id = ?
    `);
    return statement.get(id) || null;
  },

  findByEmail(email) {
    const db = getSharedDatabase();
    const statement = db.prepare(`
      SELECT id, name, email, password_hash, role, created_at, updated_at
      FROM users
      WHERE email = ? COLLATE NOCASE
    `);
    return statement.get(email) || null;
  },

  create({ name, email, passwordHash, role = 'warga' }) {
    const db = getSharedDatabase();
    const statement = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `);
    const info = statement.run(name, email, passwordHash, role);
    return this.findById(info.lastInsertRowid);
  },

  updateProfile(id, { name, passwordHash }) {
    const db = getSharedDatabase();
    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(name);
    }

    if (passwordHash !== undefined) {
      fields.push('password_hash = ?');
      params.push(passwordHash);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...params);
    return this.findById(id);
  },

  findAll({ limit = 50, offset = 0 } = {}) {
    const db = getSharedDatabase();
    const statement = db.prepare(`
      SELECT id, name, email, role, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    return statement.all(limit, offset);
  },

  countAll() {
    const db = getSharedDatabase();
    const row = db.prepare('SELECT COUNT(*) AS total FROM users').get();
    return row.total;
  },
};
