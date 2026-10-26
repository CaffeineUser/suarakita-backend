import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { getSharedDatabase } from './database.js';

const backendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bootstrapAdminSchema = z.object({
  name: z.string().trim().min(3).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(12).max(100),
});

export async function initializeDatabase() {
  const database = getSharedDatabase();

  database.exec(
    readFileSync(resolve(backendDirectory, 'database/schema.sql'), 'utf8'),
  );
  database.exec(
    readFileSync(resolve(backendDirectory, 'database/seed.sql'), 'utf8'),
  );

  const seedDemoAccounts =
    process.env.SEED_DEMO_ACCOUNTS?.toLowerCase() === 'true' ||
    (process.env.VERCEL &&
      process.env.SEED_DEMO_ACCOUNTS?.toLowerCase() !== 'false');

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
    const insertDemoUser = database.prepare(`
      INSERT OR IGNORE INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `);
    const findDemoUser = database.prepare(
      'SELECT 1 FROM users WHERE email = ? COLLATE NOCASE',
    );

    for (const demoUser of demoUsers) {
      if (findDemoUser.get(demoUser.email)) {
        continue;
      }
      const passwordHash = await bcrypt.hash(demoUser.password, 10);
      insertDemoUser.run(
        demoUser.name,
        demoUser.email,
        passwordHash,
        demoUser.role,
      );
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

  const existingAdmin = database
    .prepare('SELECT role FROM users WHERE email = ? COLLATE NOCASE')
    .get(parsedAdmin.data.email);

  if (existingAdmin) {
    if (existingAdmin.role !== 'admin') {
      throw new Error(
        'Email bootstrap admin sudah digunakan oleh akun non-admin.',
      );
    }
    return;
  }

  const passwordHash = await bcrypt.hash(parsedAdmin.data.password, 12);
  database
    .prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    )
    .run(
      parsedAdmin.data.name,
      parsedAdmin.data.email,
      passwordHash,
      'admin',
    );
}
