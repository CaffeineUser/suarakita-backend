import { getSharedDatabase, queryAll, queryOne } from '../config/database.js';

export const userRepository = {
  async findById(id) {
    return queryOne(
      getSharedDatabase(),
      `SELECT id, name, email, role, created_at, updated_at
       FROM users WHERE id = ?`,
      [id],
    );
  },

  async findByEmail(email) {
    return queryOne(
      getSharedDatabase(),
      `SELECT id, name, email, password_hash, role, created_at, updated_at
       FROM users WHERE email = ? COLLATE NOCASE`,
      [email],
    );
  },

  async create({ name, email, passwordHash, role = 'warga' }) {
    const result = await getSharedDatabase().execute({
      sql: `INSERT INTO users (name, email, password_hash, role)
            VALUES (?, ?, ?, ?)`,
      args: [name, email, passwordHash, role],
    });
    return this.findById(Number(result.lastInsertRowid));
  },

  async updateProfile(id, { name, passwordHash }) {
    const fields = [];
    const args = [];

    if (name !== undefined) {
      fields.push('name = ?');
      args.push(name);
    }

    if (passwordHash !== undefined) {
      fields.push('password_hash = ?');
      args.push(passwordHash);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    args.push(id);
    await getSharedDatabase().execute({
      sql: `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      args,
    });
    return this.findById(id);
  },

  async findAll({ limit = 50, offset = 0 } = {}) {
    return queryAll(
      getSharedDatabase(),
      `SELECT id, name, email, role, created_at, updated_at
       FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
  },

  async countAll() {
    const row = await queryOne(
      getSharedDatabase(),
      'SELECT COUNT(*) AS total FROM users',
    );
    return row.total;
  },
};
