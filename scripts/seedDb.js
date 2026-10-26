import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../src/config/database.js';
import { calculatePriorityScore } from '../src/utils/priority.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const seedSql = readFileSync(resolve(scriptDirectory, '../database/seed.sql'), 'utf8');
const database = getDatabase();

// 1. Eksekusi skrip kategori bawaan
database.exec(seedSql);

// 2. Siapkan akun demo sesuai AGENTS.md
const wargaHash = bcrypt.hashSync('WargaDemo123!', 10);
const adminHash = bcrypt.hashSync('AdminDemo123!', 10);

const insertUser = database.prepare(`
  INSERT INTO users (name, email, password_hash, role)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(email) DO UPDATE SET
    name = excluded.name,
    password_hash = excluded.password_hash,
    role = excluded.role
`);

insertUser.run('Warga Demo', 'warga@example.com', wargaHash, 'warga');
insertUser.run('Admin Demo', 'admin@example.com', adminHash, 'admin');

// 3. Pastikan folder uploads dan file foto demo tersedia
const uploadDir = resolve(scriptDirectory, '../uploads');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

const samplePhotoPath = resolve(uploadDir, 'demo-jalan-rusak.jpg');
if (!existsSync(samplePhotoPath)) {
  // Minimal valid 1x1 JPEG buffer
  const sampleJpgBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01,
    0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff,
    0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
    0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0xbf, 0x00, 0xff, 0xd9,
  ]);
  writeFileSync(samplePhotoPath, sampleJpgBuffer);
}

// 4. Buat contoh laporan awal jika belum ada laporan sama sekali
const reportCount = database.prepare('SELECT COUNT(*) AS total FROM reports').get().total;
if (reportCount === 0) {
  const wargaUser = database.prepare("SELECT id FROM users WHERE email = 'warga@example.com'").get();
  const jalanCategory = database.prepare("SELECT id FROM categories WHERE name = 'Jalan Rusak'").get();

  if (wargaUser && jalanCategory) {
    const score = calculatePriorityScore('tinggi', 0);
    const insertReport = database.prepare(`
      INSERT INTO reports (
        user_id, category_id, title, description, location_name,
        latitude, longitude, photo_path, urgency, status, priority_score
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertReport.run(
      wargaUser.id,
      jalanCategory.id,
      'Jalan Berlubang di Dekat Pasar Pagi',
      'Terdapat lubang sedalam 15 cm di tengah jalan yang membahayakan pengendara motor saat hujan.',
      'Jl. Merdeka No. 45, dekat Pasar Pagi',
      -6.2088,
      106.8456,
      'demo-jalan-rusak.jpg',
      'tinggi',
      'diajukan',
      score,
    );

    database.prepare(`
      INSERT INTO report_status_history (report_id, changed_by, old_status, new_status, note)
      VALUES (?, ?, NULL, 'diajukan', 'Laporan awal dibuat.')
    `).run(result.lastInsertRowid, wargaUser.id);
  }
}

database.close();

console.log('Database SuaraKita berhasil di-seed dengan data kategori, akun demo, dan contoh laporan.');
