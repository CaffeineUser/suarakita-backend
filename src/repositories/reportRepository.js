import { getSharedDatabase, queryAll, queryOne } from '../config/database.js';

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

function supportSelection(currentUserId, args) {
  if (!currentUserId) {
    return '0 AS is_supported_by_me';
  }
  args.push(currentUserId);
  return `EXISTS(
    SELECT 1 FROM report_supports rs_me
    WHERE rs_me.report_id = r.id AND rs_me.user_id = ?
  ) AS is_supported_by_me`;
}

function formatReport(report) {
  return {
    ...report,
    is_supported_by_me: Boolean(report.is_supported_by_me),
  };
}

const REPORT_SELECT = `
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
    %SUPPORT_SELECTION%
  FROM reports r
  JOIN users u ON r.user_id = u.id
  JOIN categories c ON r.category_id = c.id
`;

export const reportRepository = {
  async findAll({
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
    const conditions = [];
    const filterArgs = [];

    if (q) {
      conditions.push(
        '(r.title LIKE ? OR r.description LIKE ? OR r.location_name LIKE ?)',
      );
      const searchPattern = `%${q}%`;
      filterArgs.push(searchPattern, searchPattern, searchPattern);
    }
    if (categoryId) {
      conditions.push('r.category_id = ?');
      filterArgs.push(categoryId);
    }
    if (status) {
      conditions.push('r.status = ?');
      filterArgs.push(status);
    }
    if (urgency) {
      conditions.push('r.urgency = ?');
      filterArgs.push(urgency);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';
    const countRow = await queryOne(
      db,
      `SELECT COUNT(*) AS total FROM reports r ${whereClause}`,
      filterArgs,
    );
    const total = countRow?.total ?? 0;
    const sortColumn = ALLOWED_SORT_COLUMNS[sort] || 'r.priority_score';
    const sortDirection = ALLOWED_ORDER_DIRECTIONS[order] || 'DESC';
    const offset = Math.max(0, (page - 1) * limit);
    const selectArgs = [];
    const select = REPORT_SELECT.replace(
      '%SUPPORT_SELECTION%',
      supportSelection(currentUserId, selectArgs),
    );
    const rows = await queryAll(
      db,
      `${select}
       ${whereClause}
       ORDER BY ${sortColumn} ${sortDirection}, r.id DESC
       LIMIT ? OFFSET ?`,
      [...selectArgs, ...filterArgs, limit, offset],
    );
    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return {
      data: rows.map(formatReport),
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    };
  },

  async findById(id, currentUserId = null, database = getSharedDatabase()) {
    const args = [];
    const select = REPORT_SELECT.replace(
      '%SUPPORT_SELECTION%',
      supportSelection(currentUserId, args),
    );
    args.push(id);
    const report = await queryOne(
      database,
      `${select} WHERE r.id = ?`,
      args,
    );
    return report ? formatReport(report) : null;
  },

  async create(
    {
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
    },
    database = getSharedDatabase(),
  ) {
    const result = await database.execute({
      sql: `INSERT INTO reports (
              user_id, category_id, title, description, location_name,
              latitude, longitude, photo_path, urgency, status, priority_score
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'diajukan', ?)`,
      args: [
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
      ],
    });
    return Number(result.lastInsertRowid);
  },

  async update(id, fields, database = getSharedDatabase()) {
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
    const setClauses = [];
    const args = [];

    for (const key of allowedKeys) {
      if (fields[key] !== undefined) {
        setClauses.push(`${key} = ?`);
        args.push(fields[key]);
      }
    }
    if (setClauses.length === 0) {
      return this.findById(id, null, database);
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    args.push(id);
    await database.execute({
      sql: `UPDATE reports SET ${setClauses.join(', ')} WHERE id = ?`,
      args,
    });
    return this.findById(id, null, database);
  },

  async delete(id, database = getSharedDatabase()) {
    const result = await database.execute({
      sql: 'DELETE FROM reports WHERE id = ?',
      args: [id],
    });
    return result.rowsAffected > 0;
  },
};
