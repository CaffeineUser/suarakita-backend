import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, resolve } from 'node:path';

const require = createRequire(import.meta.url);
let sharedDatabase = null;

export function getDatabase(options = {}) {
  const configuredDatabasePath = process.env.DATABASE_PATH?.trim();
  const defaultDatabasePath = process.env.VERCEL
    ? '/tmp/suarakita.sqlite'
    : './database/suarakita.sqlite';
  const databasePath = resolve(
    process.env.VERCEL &&
      configuredDatabasePath &&
      !isAbsolute(configuredDatabasePath)
      ? defaultDatabasePath
      : configuredDatabasePath || defaultDatabasePath,
  );

  mkdirSync(dirname(databasePath), { recursive: true });

  let database = null;

  // 1. Coba muat better-sqlite3 terlebih dahulu
  try {
    const BetterSqlite3 = require('better-sqlite3');
    database = new BetterSqlite3(databasePath, options);
  } catch (_err) {
    // 2. Jika better-sqlite3 native binding tidak ditemukan di sistem Windows (misal Node 24 tanpa build tools),
    // fallback ke modul bawaan resmi node:sqlite yang tersedia di Node >= 22.5
    try {
      const { DatabaseSync } = require('node:sqlite');
      database = new DatabaseSync(databasePath, options);

      // Adapter method agar kompatibel 100% dengan better-sqlite3
      if (!database.pragma) {
        database.pragma = (sql) => {
          database.exec(`PRAGMA ${sql};`);
        };
      }

      if (!database.transaction) {
        database.transaction = (fn) => {
          return (...args) => {
            database.exec('BEGIN');
            try {
              const result = fn(...args);
              database.exec('COMMIT');
              return result;
            } catch (error) {
              database.exec('ROLLBACK');
              throw error;
            }
          };
        };
      }
    } catch (nodeSqliteErr) {
      throw new Error(
        `Gagal membuka koneksi database SQLite: ${nodeSqliteErr.message}`,
      );
    }
  }

  database.pragma('foreign_keys = ON');
  return database;
}

export function getSharedDatabase() {
  if (!sharedDatabase) {
    sharedDatabase = getDatabase();
  }
  return sharedDatabase;
}

export default getSharedDatabase;
