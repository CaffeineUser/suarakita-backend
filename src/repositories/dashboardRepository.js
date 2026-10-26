import { getSharedDatabase } from '../config/database.js';

export const dashboardRepository = {
  getSummary() {
    const db = getSharedDatabase();

    const reportStats = db.prepare(`
      SELECT 
        COUNT(*) AS total_reports,
        SUM(CASE WHEN status = 'diajukan' THEN 1 ELSE 0 END) AS pending_reports,
        SUM(CASE WHEN status IN ('diverifikasi', 'diproses') THEN 1 ELSE 0 END) AS in_progress_reports,
        SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END) AS completed_reports,
        SUM(CASE WHEN status = 'ditolak' THEN 1 ELSE 0 END) AS rejected_reports
      FROM reports
    `).get();

    const userStats = db.prepare('SELECT COUNT(*) AS total_users FROM users').get();
    const supportStats = db.prepare('SELECT COUNT(*) AS total_supports FROM report_supports').get();

    return {
      total_reports: reportStats?.total_reports || 0,
      pending_reports: reportStats?.pending_reports || 0,
      in_progress_reports: reportStats?.in_progress_reports || 0,
      completed_reports: reportStats?.completed_reports || 0,
      rejected_reports: reportStats?.rejected_reports || 0,
      total_users: userStats?.total_users || 0,
      total_supports: supportStats?.total_supports || 0,
    };
  },

  getByCategory() {
    const db = getSharedDatabase();
    const statement = db.prepare(`
      SELECT 
        c.id AS category_id,
        c.name AS category_name,
        COUNT(r.id) AS count
      FROM categories c
      LEFT JOIN reports r ON c.id = r.category_id
      GROUP BY c.id, c.name
      ORDER BY count DESC, c.name ASC
    `);
    return statement.all();
  },

  getByStatus() {
    const db = getSharedDatabase();
    const statement = db.prepare(`
      SELECT 
        status,
        COUNT(*) AS count
      FROM reports
      GROUP BY status
    `);
    const rows = statement.all();

    // Pastikan semua 5 status terwakili agar grafik frontend stabil
    const standardStatuses = ['diajukan', 'diverifikasi', 'diproses', 'selesai', 'ditolak'];
    const countMap = new Map(rows.map((row) => [row.status, row.count]));

    return standardStatuses.map((st) => ({
      status: st,
      count: countMap.get(st) || 0,
    }));
  },

  getPriorityReports(limit = 5) {
    const db = getSharedDatabase();
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 5));

    const statement = db.prepare(`
      SELECT 
        r.id,
        r.title,
        r.location_name,
        c.name AS category_name,
        r.urgency,
        r.status,
        r.priority_score,
        (SELECT COUNT(*) FROM report_supports rs WHERE rs.report_id = r.id) AS support_count,
        r.created_at
      FROM reports r
      JOIN categories c ON r.category_id = c.id
      ORDER BY r.priority_score DESC, r.created_at DESC
      LIMIT ?
    `);

    return statement.all(safeLimit);
  },
};
