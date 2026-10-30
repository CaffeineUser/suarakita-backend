# Menjalankan SuaraKita dengan Turso

Backend memakai `@libsql/client` untuk koneksi database asinkron. Turso digunakan bila
`TURSO_DATABASE_URL` diatur; tanpa variabel itu, lingkungan lokal memakai berkas SQLite
(`database/suarakita.sqlite` secara default).

## Konfigurasi

1. Buat database Turso dan ambil URL serta token akses:

   ```sh
   turso db create suarakita
   turso db show --url suarakita
   turso db tokens create suarakita
   ```

2. Atur variabel berikut di `.env` lokal dan di pengaturan environment deployment:

   ```dotenv
   TURSO_DATABASE_URL=libsql://<database>.<organization>.turso.io
   TURSO_AUTH_TOKEN=<token>
   ```

   Jangan commit token ke Git. `TURSO_AUTH_TOKEN` wajib untuk URL database jarak jauh.

3. Terapkan skema ke Turso:

   ```sh
   npm run db:init
   ```

   Saat server dijalankan, skema serta kategori bawaan juga disiapkan secara idempoten.
   Akun demo hanya dibuat bila `SEED_DEMO_ACCOUNTS=true`; konfigurasi admin awal tetap
   memakai `BOOTSTRAP_ADMIN_EMAIL` dan `BOOTSTRAP_ADMIN_PASSWORD`.

## Memindahkan data SQLite lokal

`npm run db:init` hanya membuat skema, tidak menyalin data. Untuk memindahkan data
SQLite yang sudah ada, pastikan database Turso tujuan masih kosong, lalu jalankan:

```sh
npm run db:migrate:turso
```

Skrip memakai `database/suarakita.sqlite` sebagai sumber secara default. Untuk file lain,
atur `SOURCE_DATABASE_PATH`. Migrasi menyalin pengguna, kategori, laporan, dukungan, dan
riwayat status dengan ID yang dipertahankan. Migrasi dibatalkan bila tabel tujuan sudah
berisi data agar tidak menimpa atau menggandakan data.

Foto laporan disimpan di direktori upload, bukan di database; pindahkan file tersebut ke
penyimpanan yang tetap tersedia pada deployment dan pastikan `UPLOAD_DIR` sesuai.
