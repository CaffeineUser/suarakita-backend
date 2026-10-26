import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDatabase } from '../src/config/database.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(resolve(scriptDirectory, '../database/schema.sql'), 'utf8');
const database = getDatabase();

database.exec(schema);
database.close();

console.log('Skema database SuaraKita berhasil disiapkan.');
