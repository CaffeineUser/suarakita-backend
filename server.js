import 'dotenv/config';
import app from './app.js';
import { initializeDatabase } from './src/config/initializeDatabase.js';

await initializeDatabase();

const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, () => {
  console.log(`SuaraKita API berjalan pada port ${port}.`);
});

function shutdown(signal) {
  console.log(`${signal} diterima. Menutup server...`);
  server.close((error) => {
    if (error) {
      console.error('Gagal menutup server dengan baik.', error);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
