import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';
import {
  getDatabase,
  queryAll,
  queryOne,
  runInTransaction,
} from '../src/config/database.js';

const rootDirectory = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourcePath = resolve(
  process.env.SOURCE_DATABASE_PATH || resolve(rootDirectory, 'database/suarakita.sqlite'),
);
const targetUrl = process.env.TURSO_DATABASE_URL?.trim();

if (!targetUrl || targetUrl.startsWith('file:')) {
  throw new Error(
    'Atur TURSO_DATABASE_URL ke URL database Turso sebelum menjalankan migrasi.',
  );
}
if (!existsSync(sourcePath)) {
  throw new Error(`Database sumber tidak ditemukan: ${sourcePath}`);
}

const source = createClient({
  url: pathToFileURL(sourcePath).href,
  intMode: 'number',
});
const target = getDatabase();
const tables = [
  {
    name: 'users',
    columns: [
      'id',
      'name',
      'email',
      'password_hash',
      'role',
      'created_at',
      'updated_at',
    ],
  },
  {
    name: 'categories',
    columns: [
      'id',
      'name',
      'description',
      'is_active',
      'created_at',
      'updated_at',
    ],
  },
  {
    name: 'reports',
    columns: [
      'id',
      'user_id',
      'category_id',
      'title',
      'description',
      'location_name',
      'latitude',
      'longitude',
      'photo_path',
      'urgency',
      'status',
      'priority_score',
      'created_at',
      'updated_at',
    ],
  },
  {
    name: 'report_supports',
    columns: ['id', 'report_id', 'user_id', 'created_at'],
  },
  {
    name: 'report_status_history',
    columns: [
      'id',
      'report_id',
      'changed_by',
      'old_status',
      'new_status',
      'note',
      'created_at',
    ],
  },
];

try {
  await target.execute('PRAGMA foreign_keys = ON');
  const schema = readFileSync(
    resolve(rootDirectory, 'database/schema.sql'),
    'utf8',
  );
  await target.executeMultiple(schema);

  for (const table of tables) {
    const row = await queryOne(
      target,
      `SELECT COUNT(*) AS total FROM ${table.name}`,
    );
    if (row.total > 0) {
      throw new Error(
        `Tabel ${table.name} di Turso tidak kosong. Migrasi dibatalkan agar data tidak tertimpa atau terduplikasi.`,
      );
    }
  }

  const rowsByTable = new Map();
  for (const table of tables) {
    rowsByTable.set(
      table.name,
      await queryAll(source, `SELECT ${table.columns.join(', ')} FROM ${table.name}`),
    );
  }

  let migratedRows = 0;
  await runInTransaction(target, async (transaction) => {
    for (const table of tables) {
      const placeholders = table.columns.map(() => '?').join(', ');
      for (const row of rowsByTable.get(table.name)) {
        await transaction.execute({
          sql: `INSERT INTO ${table.name} (${table.columns.join(', ')})
                VALUES (${placeholders})`,
          args: table.columns.map((column) => row[column]),
        });
        migratedRows += 1;
      }
    }
  });

  console.log(
    `Migrasi database berhasil. ${migratedRows} baris dipindahkan dari ${sourcePath} ke Turso.`,
  );
} finally {
  source.close();
  target.close();
}
