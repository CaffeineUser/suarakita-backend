import { getSharedDatabase } from '../config/database.js';

export const supportRepository = {
  findUserSupport(reportId, userId, db = null) {
    const conn = db || getSharedDatabase();
    return conn
      .prepare('SELECT id, report_id, user_id, created_at FROM report_supports WHERE report_id = ? AND user_id = ?')
      .get(reportId, userId) || null;
  },

  countByReportId(reportId, db = null) {
    const conn = db || getSharedDatabase();
    const row = conn
      .prepare('SELECT COUNT(*) AS total FROM report_supports WHERE report_id = ?')
      .get(reportId);
    return row ? row.total : 0;
  },

  findByReportId(reportId) {
    const db = getSharedDatabase();
    const statement = db.prepare(`
      SELECT 
        s.id,
        s.report_id,
        s.user_id,
        u.name AS user_name,
        s.created_at
      FROM report_supports s
      JOIN users u ON s.user_id = u.id
      WHERE s.report_id = ?
      ORDER BY s.created_at DESC
    `);
    return statement.all(reportId);
  },

  create(reportId, userId, db = null) {
    const conn = db || getSharedDatabase();
    const statement = conn.prepare(`
      INSERT INTO report_supports (report_id, user_id)
      VALUES (?, ?)
    `);
    const info = statement.run(reportId, userId);
    return info.lastInsertRowid;
  },

  delete(reportId, userId, db = null) {
    const conn = db || getSharedDatabase();
    const statement = conn.prepare('DELETE FROM report_supports WHERE report_id = ? AND user_id = ?');
    const info = statement.run(reportId, userId);
    return info.changes > 0;
  },
};
