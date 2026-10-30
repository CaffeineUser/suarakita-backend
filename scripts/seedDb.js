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

await database.execute('PRAGMA foreign_keys = ON');

// 1. Eksekusi skrip kategori bawaan
await database.executeMultiple(seedSql);

// 2. Siapkan akun demo sesuai AGENTS.md
const wargaHash = bcrypt.hashSync('WargaDemo123!', 10);
const adminHash = bcrypt.hashSync('AdminDemo123!', 10);

const insertUserSql = `
  INSERT INTO users (name, email, password_hash, role)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(email) DO UPDATE SET
    name = excluded.name,
    password_hash = excluded.password_hash,
    role = excluded.role
`;

await database.execute({
  sql: insertUserSql,
  args: ['Warga Demo', 'warga@example.com', wargaHash, 'warga'],
});
await database.execute({
  sql: insertUserSql,
  args: ['Admin Demo', 'admin@example.com', adminHash, 'admin'],
});

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
const reportCount = (
  await database.execute('SELECT COUNT(*) AS total FROM reports')
).rows[0].total;
if (reportCount === 0) {
  const wargaUser = (
    await database.execute("SELECT id FROM users WHERE email = 'warga@example.com'")
  ).rows[0];
  const jalanCategory = (
    await database.execute("SELECT id FROM categories WHERE name = 'Jalan Rusak'")
  ).rows[0];

  if (wargaUser && jalanCategory) {
    const score = calculatePriorityScore('tinggi', 0);
    const reportResult = await database.execute({
      sql: `
      INSERT INTO reports (
        user_id, category_id, title, description, location_name,
        latitude, longitude, photo_path, urgency, status, priority_score
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
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
      ],
    });

    await database.execute({
      sql: `
        INSERT INTO report_status_history
          (report_id, changed_by, old_status, new_status, note)
        VALUES (?, ?, NULL, 'diajukan', 'Laporan awal dibuat.')
      `,
      args: [Number(reportResult.lastInsertRowid), wargaUser.id],
    });
  }
}

await database.close();

console.log('Database SuaraKita berhasil di-seed dengan data kategori, akun demo, dan contoh laporan.');
