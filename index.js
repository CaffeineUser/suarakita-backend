import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';
import { getSharedDatabase } from './src/config/database.js';

const backendDirectory = dirname(fileURLToPath(import.meta.url));
const database = getSharedDatabase();

database.exec(
  readFileSync(resolve(backendDirectory, 'database/schema.sql'), 'utf8'),
);
database.exec(
  readFileSync(resolve(backendDirectory, 'database/seed.sql'), 'utf8'),
);

export default app;
