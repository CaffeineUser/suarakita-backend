CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'warga' CHECK (role IN ('warga', 'admin')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_name TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  photo_path TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'sedang'
    CHECK (urgency IN ('rendah', 'sedang', 'tinggi', 'kritis')),
  status TEXT NOT NULL DEFAULT 'diajukan'
    CHECK (status IN ('diajukan', 'diverifikasi', 'diproses', 'selesai', 'ditolak')),
  priority_score REAL NOT NULL DEFAULT 30 CHECK (priority_score BETWEEN 0 AND 100),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE IF NOT EXISTS report_supports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (report_id, user_id)
);

CREATE TABLE IF NOT EXISTS report_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  old_status TEXT
    CHECK (old_status IS NULL OR old_status IN ('diajukan', 'diverifikasi', 'diproses', 'selesai', 'ditolak')),
  new_status TEXT NOT NULL
    CHECK (new_status IN ('diajukan', 'diverifikasi', 'diproses', 'selesai', 'ditolak')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_urgency ON reports(urgency);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON reports(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_supports_report ON report_supports(report_id);
CREATE INDEX IF NOT EXISTS idx_status_history_report ON report_status_history(report_id, created_at);
