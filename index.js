import app from './app.js';
import { initializeDatabase } from './src/config/initializeDatabase.js';

await initializeDatabase();

export default app;
