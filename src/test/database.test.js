import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@libsql/client', () => ({ createClient }));

const originalEnv = {
  databasePath: process.env.DATABASE_PATH,
  tursoUrl: process.env.TURSO_DATABASE_URL,
  tursoToken: process.env.TURSO_AUTH_TOKEN,
  vercel: process.env.VERCEL,
};

function restoreEnvironment() {
  if (originalEnv.databasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalEnv.databasePath;
  if (originalEnv.tursoUrl === undefined) delete process.env.TURSO_DATABASE_URL;
  else process.env.TURSO_DATABASE_URL = originalEnv.tursoUrl;
  if (originalEnv.tursoToken === undefined) delete process.env.TURSO_AUTH_TOKEN;
  else process.env.TURSO_AUTH_TOKEN = originalEnv.tursoToken;
  if (originalEnv.vercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalEnv.vercel;
}

beforeEach(() => {
  vi.resetModules();
  createClient.mockReset();
  createClient.mockImplementation((config) => ({
    config,
    close: vi.fn(),
    execute: vi.fn().mockResolvedValue({ rows: [{ value: 1 }] }),
    transaction: vi.fn(),
  }));
});

afterEach(() => {
  restoreEnvironment();
});

describe('database configuration', () => {
  test('requires a remote Turso auth token', async () => {
    process.env.TURSO_DATABASE_URL = 'libsql://example.turso.io';
    delete process.env.TURSO_AUTH_TOKEN;
    const { getDatabase } = await import('../config/database.js');
    expect(() => getDatabase()).toThrow('TURSO_AUTH_TOKEN wajib diatur');
  });

  test('requires a Turso URL on Vercel when a local path is not configured', async () => {
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.DATABASE_PATH;
    process.env.VERCEL = '1';
    const { getDatabase } = await import('../config/database.js');
    expect(() => getDatabase()).toThrow('TURSO_DATABASE_URL wajib diatur');
  });

  test('opens a configured local path without a remote auth token', async () => {
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    delete process.env.VERCEL;
    process.env.DATABASE_PATH = './local-test.sqlite';
    const { getDatabase } = await import('../config/database.js');

    getDatabase();

    expect(createClient).toHaveBeenCalledWith({
      url: expect.stringMatching(/local-test\.sqlite$/),
      intMode: 'number',
    });
  });

  test('uses the default local database path when no path is configured', async () => {
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    delete process.env.DATABASE_PATH;
    delete process.env.VERCEL;
    const { getDatabase } = await import('../config/database.js');

    getDatabase();

    expect(createClient).toHaveBeenCalledWith({
      url: expect.stringMatching(/database\/suarakita\.sqlite$/),
      intMode: 'number',
    });
  });

  test('uses the Vercel fallback database path when explicitly configured', async () => {
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    process.env.VERCEL = '1';
    process.env.DATABASE_PATH = 'custom.sqlite';
    const { getDatabase } = await import('../config/database.js');

    getDatabase();

    expect(createClient).toHaveBeenCalledWith({
      url: expect.stringMatching(/custom\.sqlite$/),
      intMode: 'number',
    });
  });

  test('creates an authenticated remote client when URL and token are configured', async () => {
    process.env.TURSO_DATABASE_URL = 'libsql://example.turso.io';
    process.env.TURSO_AUTH_TOKEN = 'test-token';
    const { getDatabase } = await import('../config/database.js');

    getDatabase();

    expect(createClient).toHaveBeenCalledWith({
      url: 'libsql://example.turso.io',
      authToken: 'test-token',
      intMode: 'number',
    });
  });

  test('supports local libSQL URLs and trims environment values', async () => {
    process.env.TURSO_DATABASE_URL = ' file::memory: ';
    process.env.TURSO_AUTH_TOKEN = ' ';
    const { getDatabase } = await import('../config/database.js');

    getDatabase();

    expect(createClient).toHaveBeenCalledWith({
      url: 'file::memory:',
      intMode: 'number',
    });
  });

  test('caches a shared client and exposes query helpers', async () => {
    process.env.TURSO_DATABASE_URL = 'file::memory:';
    delete process.env.TURSO_AUTH_TOKEN;
    const {
      executeSql,
      getSharedDatabase,
      queryAll,
      queryOne,
    } = await import('../config/database.js');
    const database = getSharedDatabase();
    expect(getSharedDatabase()).toBe(database);
    await executeSql(database, 'SELECT 1');
    expect(await queryOne(database, 'SELECT 1')).toMatchObject({ value: 1 });
    expect(await queryAll(database, 'SELECT 1')).toEqual([{ value: 1 }]);

    database.execute.mockResolvedValueOnce({ rows: [] });
    expect(await queryOne(database, 'SELECT 1')).toBeNull();
  });

  test('commits successful transactions and rolls back failures', async () => {
    const transaction = {
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    };
    const database = { transaction: vi.fn().mockResolvedValue(transaction) };
    const { runInTransaction } = await import('../config/database.js');

    await expect(runInTransaction(database, async () => 'committed')).resolves.toBe(
      'committed',
    );
    expect(transaction.commit).toHaveBeenCalledOnce();

    const originalError = new Error('transaction failed');
    await expect(
      runInTransaction(database, async () => {
        throw originalError;
      }),
    ).rejects.toBe(originalError);
    expect(transaction.rollback).toHaveBeenCalledOnce();
  });

  test('propagates a transaction rollback failure', async () => {
    const rollbackError = new Error('rollback failed');
    const transaction = {
      rollback: vi.fn().mockRejectedValue(rollbackError),
    };
    const database = {
      transaction: vi.fn().mockResolvedValue(transaction),
    };
    const { runInTransaction } = await import('../config/database.js');
    await expect(
      runInTransaction(database, async () => {
        throw new Error('work failed');
      }),
    ).rejects.toBe(rollbackError);
    expect(transaction.rollback).toHaveBeenCalledOnce();
  });
});
