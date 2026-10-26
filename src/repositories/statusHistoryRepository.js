import { getSharedDatabase } from '../config/database.js';

export const statusHistoryRepository = {
  create({ reportId, changedBy = null, oldStatus = null, newStatus, note = null }, db = null) {
    const conn = db || getSharedDatabase();
    const statement = conn.prepare(`
      INSERT INTO report_status_history (report_id, changed_by, old_status, new_status, note)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = statement.run(reportId, changedBy, oldStatus, newStatus, note);
    return info.lastInsertRowid;
  },

  findByReportId(reportId) {
    const db = getSharedDatabase();
    const statement = db.prepare(`
      SELECT 
        h.id,
        h.report_id,
        h.changed_by,
        u.name AS changed_by_name,
        u.role AS changed_by_role,
        h.old_status,
        h.new_status,
        h.note,
        h.created_at
      FROM report_status_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.report_id = ?
      ORDER BY h.created_at ASC, h.id ASC
    `);
    return statement.all(reportId);
  },
};
