import { getSharedDatabase } from '../config/database.js';

const ALLOWED_SORT_COLUMNS = {
  priority_score: 'r.priority_score',
  created_at: 'r.created_at',
  urgency: 'r.urgency',
  title: 'r.title',
  support_count: 'support_count',
};

const ALLOWED_ORDER_DIRECTIONS = {
  asc: 'ASC',
  desc: 'DESC',
  ASC: 'ASC',
  DESC: 'DESC',
};

export const reportRepository = {
  findAll({
    q = null,
    categoryId = null,
    status = null,
    urgency = null,
    sort = 'priority_score',
    order = 'desc',
    page = 1,
    limit = 10,
    currentUserId = null,
  } = {}) {
    const db = getSharedDatabase();
    const whereConditions = [];
    const params = [];

    // Optional user support flag param
    let selectUserSupport = '0 AS is_supported_by_me';
    const selectParams = [];
    if (currentUserId) {
      selectUserSupport = `EXISTS(
        SELECT 1 FROM report_supports rs_me 
        WHERE rs_me.report_id = r.id AND rs_me.user_id = ?
      ) AS is_supported_by_me`;
      selectParams.push(currentUserId);
    }

    if (q) {
      whereConditions.push('(r.title LIKE ? OR r.description LIKE ? OR r.location_name LIKE ?)');
      const searchPattern = `%${q}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (categoryId) {
      whereConditions.push('r.category_id = ?');
      params.push(categoryId);
    }

    if (status) {
      whereConditions.push('r.status = ?');
      params.push(status);
    }

    if (urgency) {
      whereConditions.push('r.urgency = ?');
      params.push(urgency);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Hitung total item untuk pagination
    const countSql = `
      SELECT COUNT(*) AS total 
      FROM reports r
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...params);
    const total = countRow ? countRow.total : 0;

    // Tentukan order by aman dari allowlist
    const sortColumn = ALLOWED_SORT_COLUMNS[sort] || 'r.priority_score';
    const sortDirection = ALLOWED_ORDER_DIRECTIONS[order] || 'DESC';

    const offset = Math.max(0, (page - 1) * limit);

    const query = `
      SELECT 
        r.id,
        r.user_id,
        u.name AS reporter_name,
        r.category_id,
        c.name AS category_name,
        r.title,
        r.description,
        r.location_name,
        r.latitude,
        r.longitude,
        r.photo_path,
        r.urgency,
        r.status,
        r.priority_score,
        r.created_at,
        r.updated_at,
        (SELECT COUNT(*) FROM report_supports rs WHERE rs.report_id = r.id) AS support_count,
        ${selectUserSupport}
      FROM reports r
      JOIN users u ON r.user_id = u.id
      JOIN categories c ON r.category_id = c.id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}, r.id DESC
      LIMIT ? OFFSET ?
    `;

    const allParams = [...selectParams, ...params, limit, offset];
    const data = db.prepare(query).all(...allParams);

    // Konversi is_supported_by_me ke boolean
    const formattedData = data.map((item) => ({
      ...item,
      is_supported_by_me: Boolean(item.is_supported_by_me),
    }));

    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return {
      data: formattedData,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    };
  },

  findById(id, currentUserId = null) {
    const db = getSharedDatabase();
    let selectUserSupport = '0 AS is_supported_by_me';
    const params = [];

    if (currentUserId) {
      selectUserSupport = `EXISTS(
        SELECT 1 FROM report_supports rs_me 
        WHERE rs_me.report_id = r.id AND rs_me.user_id = ?
      ) AS is_supported_by_me`;
      params.push(currentUserId);
    }
    params.push(id);

    const statement = db.prepare(`
      SELECT 
        r.id,
        r.user_id,
        u.name AS reporter_name,
        r.category_id,
        c.name AS category_name,
        r.title,
        r.description,
        r.location_name,
        r.latitude,
        r.longitude,
        r.photo_path,
        r.urgency,
        r.status,
        r.priority_score,
        r.created_at,
        r.updated_at,
        (SELECT COUNT(*) FROM report_supports rs WHERE rs.report_id = r.id) AS support_count,
        ${selectUserSupport}
      FROM reports r
      JOIN users u ON r.user_id = u.id
      JOIN categories c ON r.category_id = c.id
      WHERE r.id = ?
    `);

    const item = statement.get(...params);
    if (!item) return null;

    return {
      ...item,
      is_supported_by_me: Boolean(item.is_supported_by_me),
    };
  },

  create({
    userId,
    categoryId,
    title,
    description,
    locationName,
    latitude = null,
    longitude = null,
    photoPath,
    urgency = 'sedang',
    priorityScore = 30,
  }, db = null) {
    const conn = db || getSharedDatabase();
    const statement = conn.prepare(`
      INSERT INTO reports (
        user_id, category_id, title, description, location_name,
        latitude, longitude, photo_path, urgency, status, priority_score
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'diajukan', ?)
    `);

    const info = statement.run(
      userId,
      categoryId,
      title,
      description,
      locationName,
      latitude,
      longitude,
      photoPath,
      urgency,
      priorityScore,
    );

    return info.lastInsertRowid;
  },

  update(id, fields, db = null) {
    const conn = db || getSharedDatabase();
    const setClauses = [];
    const params = [];

    const allowedKeys = [
      'category_id',
      'title',
      'description',
      'location_name',
      'latitude',
      'longitude',
      'urgency',
      'status',
      'photo_path',
      'priority_score',
    ];

    for (const key of allowedKeys) {
      if (fields[key] !== undefined) {
        setClauses.push(`${key} = ?`);
        params.push(fields[key]);
      }
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    const query = `UPDATE reports SET ${setClauses.join(', ')} WHERE id = ?`;
    conn.prepare(query).run(...params);

    return this.findById(id);
  },

  delete(id, db = null) {
    const conn = db || getSharedDatabase();
    const info = conn.prepare('DELETE FROM reports WHERE id = ?').run(id);
    return info.changes > 0;
  },
};
