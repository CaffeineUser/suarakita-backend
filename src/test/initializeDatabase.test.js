import { afterEach, describe, expect, test, vi } from 'vitest';

const variableNames = [
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'DATABASE_PATH',
  'VERCEL',
  'SEED_DEMO_ACCOUNTS',
  'DEMO_RESIDENT_PASSWORD',
  'DEMO_ADMIN_PASSWORD',
  'BOOTSTRAP_ADMIN_EMAIL',
  'BOOTSTRAP_ADMIN_PASSWORD',
  'BOOTSTRAP_ADMIN_NAME',
];
const originalEnvironment = Object.fromEntries(
  variableNames.map((name) => [name, process.env[name]]),
);

function restoreEnvironment() {
  for (const name of variableNames) {
    if (originalEnvironment[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnvironment[name];
  }
}

afterEach(() => {
  restoreEnvironment();
  vi.resetModules();
});

async function withDatabase(callback) {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  delete process.env.TURSO_AUTH_TOKEN;
  delete process.env.DATABASE_PATH;
  delete process.env.VERCEL;
  delete process.env.SEED_DEMO_ACCOUNTS;
  delete process.env.DEMO_RESIDENT_PASSWORD;
  delete process.env.DEMO_ADMIN_PASSWORD;
  delete process.env.BOOTSTRAP_ADMIN_EMAIL;
  delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
  delete process.env.BOOTSTRAP_ADMIN_NAME;
  vi.resetModules();

  const { getSharedDatabase, queryOne } = await import('../config/database.js');
  const { initializeDatabase } = await import('../config/initializeDatabase.js');
  const database = getSharedDatabase();
  try {
    await callback({ database, initializeDatabase, queryOne });
  } finally {
    await database.close();
  }
}

describe('initializeDatabase configuration', () => {
  test('seeds demo accounts only when enabled and is idempotent', async () => {
    await withDatabase(async ({ database, initializeDatabase, queryOne }) => {
      process.env.SEED_DEMO_ACCOUNTS = 'true';
      await initializeDatabase();
      await initializeDatabase();

      expect(await queryOne(database, 'SELECT COUNT(*) AS total FROM users'))
        .toMatchObject({ total: 2 });
      expect(await queryOne(
        database,
        'SELECT role FROM users WHERE email = ?',
        ['admin@example.com'],
      )).toMatchObject({ role: 'admin' });
    });

    await withDatabase(async ({ database, initializeDatabase, queryOne }) => {
      process.env.SEED_DEMO_ACCOUNTS = 'true';
      process.env.DEMO_RESIDENT_PASSWORD = 'CustomResidentPassword123!';
      process.env.DEMO_ADMIN_PASSWORD = 'CustomAdminPassword123!';
      await initializeDatabase();

      expect(await queryOne(database, 'SELECT COUNT(*) AS total FROM users'))
        .toMatchObject({ total: 2 });
    });
  });

  test.each([
    ['only email', 'admin@test.local', undefined],
    ['only password', undefined, 'LongEnoughAdminPassword123!'],
  ])('rejects bootstrap admin configuration with %s', async (_label, email, password) => {
    await withDatabase(async ({ initializeDatabase }) => {
      if (email === undefined) delete process.env.BOOTSTRAP_ADMIN_EMAIL;
      else process.env.BOOTSTRAP_ADMIN_EMAIL = email;
      if (password === undefined) delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
      else process.env.BOOTSTRAP_ADMIN_PASSWORD = password;
      await expect(initializeDatabase()).rejects.toThrow(
        'BOOTSTRAP_ADMIN_EMAIL dan BOOTSTRAP_ADMIN_PASSWORD harus diatur bersama.',
      );
    });
  });

  test('rejects invalid admin configuration', async () => {
    await withDatabase(async ({ initializeDatabase }) => {
      process.env.BOOTSTRAP_ADMIN_EMAIL = 'not-an-email';
      process.env.BOOTSTRAP_ADMIN_PASSWORD = 'short';
      process.env.BOOTSTRAP_ADMIN_NAME = 'A';
      await expect(initializeDatabase()).rejects.toThrow(
        'Konfigurasi bootstrap admin tidak valid.',
      );
    });
  });

  test('uses the default admin name and creates a configured admin', async () => {
    await withDatabase(async ({ database, initializeDatabase, queryOne }) => {
      process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin.configured@test.local';
      process.env.BOOTSTRAP_ADMIN_PASSWORD = 'LongEnoughAdminPassword123!';
      process.env.BOOTSTRAP_ADMIN_NAME = '   ';
      await initializeDatabase();

      expect(await queryOne(
        database,
        'SELECT name, role FROM users WHERE email = ?',
        ['admin.configured@test.local'],
      )).toMatchObject({ name: 'Admin', role: 'admin' });
    });
  });

  test('does not replace an existing admin account', async () => {
    await withDatabase(async ({ database, initializeDatabase, queryOne }) => {
      await initializeDatabase();
      await database.execute({
        sql: 'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        args: ['Existing Admin', 'existing.admin@test.local', 'hash', 'admin'],
      });
      process.env.BOOTSTRAP_ADMIN_EMAIL = 'existing.admin@test.local';
      process.env.BOOTSTRAP_ADMIN_PASSWORD = 'LongEnoughAdminPassword123!';

      await initializeDatabase();

      expect(await queryOne(
        database,
        'SELECT name FROM users WHERE email = ?',
        ['existing.admin@test.local'],
      )).toMatchObject({ name: 'Existing Admin' });
    });
  });

  test('rejects a bootstrap email already owned by a non-admin', async () => {
    await withDatabase(async ({ database, initializeDatabase }) => {
      await initializeDatabase();
      await database.execute({
        sql: 'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        args: ['Existing Resident', 'existing.resident@test.local', 'hash', 'warga'],
      });
      process.env.BOOTSTRAP_ADMIN_EMAIL = 'existing.resident@test.local';
      process.env.BOOTSTRAP_ADMIN_PASSWORD = 'LongEnoughAdminPassword123!';

      await expect(initializeDatabase()).rejects.toThrow(
        'Email bootstrap admin sudah digunakan oleh akun non-admin.',
      );
    });
  });
});
