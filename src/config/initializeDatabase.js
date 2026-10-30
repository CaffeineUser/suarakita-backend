import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { getSharedDatabase, queryOne } from './database.js';

const backendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bootstrapAdminSchema = z.object({
  name: z.string().trim().min(3).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(12).max(100),
});

export async function initializeDatabase() {
  const database = getSharedDatabase();

  await database.execute('PRAGMA foreign_keys = ON');
  await database.executeMultiple(
    readFileSync(resolve(backendDirectory, 'database/schema.sql'), 'utf8'),
  );
  await database.executeMultiple(
    readFileSync(resolve(backendDirectory, 'database/seed.sql'), 'utf8'),
  );

  const seedDemoAccounts =
    process.env.SEED_DEMO_ACCOUNTS?.toLowerCase() === 'true';

  if (seedDemoAccounts) {
    const demoUsers = [
      {
        name: 'Warga Demo',
        email: 'warga@example.com',
        password: 'WargaDemo123!',
        role: 'warga',
      },
      {
        name: 'Admin Demo',
        email: 'admin@example.com',
        password: 'AdminDemo123!',
        role: 'admin',
      },
    ];
    for (const demoUser of demoUsers) {
      if (
        await queryOne(
          database,
          'SELECT 1 FROM users WHERE email = ? COLLATE NOCASE',
          [demoUser.email],
        )
      ) {
        continue;
      }
      const passwordHash = await bcrypt.hash(demoUser.password, 10);
      await database.execute({
        sql: `INSERT OR IGNORE INTO users (name, email, password_hash, role)
              VALUES (?, ?, ?, ?)`,
        args: [demoUser.name, demoUser.email, passwordHash, demoUser.role],
      });
    }
  }

  const configuredAdminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  const configuredAdminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const configuredAdminName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Admin';

  if (!configuredAdminEmail && !configuredAdminPassword) {
    return;
  }

  if (!configuredAdminEmail || !configuredAdminPassword) {
    throw new Error(
      'BOOTSTRAP_ADMIN_EMAIL dan BOOTSTRAP_ADMIN_PASSWORD harus diatur bersama.',
    );
  }

  const parsedAdmin = bootstrapAdminSchema.safeParse({
    name: configuredAdminName,
    email: configuredAdminEmail,
    password: configuredAdminPassword,
  });
  if (!parsedAdmin.success) {
    throw new Error(
      'Konfigurasi bootstrap admin tidak valid. Gunakan nama minimal 3 karakter, email valid, dan kata sandi 12-100 karakter.',
    );
  }

  const existingAdmin = await queryOne(
    database,
    'SELECT role FROM users WHERE email = ? COLLATE NOCASE',
    [parsedAdmin.data.email],
  );

  if (existingAdmin) {
    if (existingAdmin.role !== 'admin') {
      throw new Error(
        'Email bootstrap admin sudah digunakan oleh akun non-admin.',
      );
    }
    return;
  }

  const passwordHash = await bcrypt.hash(parsedAdmin.data.password, 12);
  await database.execute({
    sql: 'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    args: [
      parsedAdmin.data.name,
      parsedAdmin.data.email,
      passwordHash,
      'admin',
    ],
  });
}
