import { createClient } from '@libsql/client';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

let sharedDatabase;

export function getDatabase() {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl) {
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
    if (!authToken && !tursoUrl.startsWith('file:')) {
      throw new Error('TURSO_AUTH_TOKEN wajib diatur untuk koneksi database Turso.');
    }

    return createClient({
      url: tursoUrl,
      ...(authToken ? { authToken } : {}),
      intMode: 'number',
    });
  }

  const configuredPath = process.env.DATABASE_PATH?.trim();
  if (process.env.VERCEL && !configuredPath) {
    throw new Error(
      'TURSO_DATABASE_URL wajib diatur pada deployment. DATABASE_PATH hanya didukung untuk pengembangan lokal.',
    );
  }

  const databasePath = resolve(configuredPath || './database/suarakita.sqlite');
  return createClient({
    url: pathToFileURL(databasePath).href,
    intMode: 'number',
  });
}

export function getSharedDatabase() {
  if (!sharedDatabase) {
    sharedDatabase = getDatabase();
  }
  return sharedDatabase;
}

export async function executeSql(database, sql, args = []) {
  return database.execute({ sql, args });
}

export async function queryOne(database, sql, args = []) {
  const result = await executeSql(database, sql, args);
  return result.rows[0] ?? null;
}

export async function queryAll(database, sql, args = []) {
  const result = await executeSql(database, sql, args);
  return result.rows;
}

export async function runInTransaction(database, callback) {
  const transaction = await database.transaction('write');
  try {
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export default getSharedDatabase;
