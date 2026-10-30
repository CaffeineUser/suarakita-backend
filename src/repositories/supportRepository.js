import { getSharedDatabase, queryAll, queryOne } from '../config/database.js';

export const supportRepository = {
  async findUserSupport(reportId, userId, database = getSharedDatabase()) {
    return queryOne(
      database,
      `SELECT id, report_id, user_id, created_at
       FROM report_supports WHERE report_id = ? AND user_id = ?`,
      [reportId, userId],
    );
  },

  async countByReportId(reportId, database = getSharedDatabase()) {
    const row = await queryOne(
      database,
      'SELECT COUNT(*) AS total FROM report_supports WHERE report_id = ?',
      [reportId],
    );
    return row?.total ?? 0;
  },

  async findByReportId(reportId) {
    return queryAll(
      getSharedDatabase(),
      `SELECT
         s.id,
         s.report_id,
         s.user_id,
         u.name AS user_name,
         s.created_at
       FROM report_supports s
       JOIN users u ON s.user_id = u.id
       WHERE s.report_id = ?
       ORDER BY s.created_at DESC`,
      [reportId],
    );
  },

  async create(reportId, userId, database = getSharedDatabase()) {
    const result = await database.execute({
      sql: 'INSERT INTO report_supports (report_id, user_id) VALUES (?, ?)',
      args: [reportId, userId],
    });
    return Number(result.lastInsertRowid);
  },

  async delete(reportId, userId, database = getSharedDatabase()) {
    const result = await database.execute({
      sql: 'DELETE FROM report_supports WHERE report_id = ? AND user_id = ?',
      args: [reportId, userId],
    });
    return result.rowsAffected > 0;
  },
};
