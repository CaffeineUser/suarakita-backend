import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';
import { after, before, test } from 'node:test';

const testDirectory = mkdtempSync(join(tmpdir(), 'suarakita-backend-test-'));
process.env.NODE_ENV = 'test';
process.env.VERCEL = '1';
process.env.DATABASE_PATH = join(testDirectory, 'test.sqlite');
process.env.UPLOAD_DIR = join(testDirectory, 'uploads');
process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-for-integration-tests';
process.env.CLIENT_ORIGIN =
  'http://localhost:5173,https://suarakita-frontend.example.test';
process.env.BOOTSTRAP_ADMIN_NAME = 'Admin SuaraKita';
process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin.bootstrap@test.local';
process.env.BOOTSTRAP_ADMIN_PASSWORD = 'BootstrapAdminTest123!';

const { default: app } = await import('../index.js');
const { getSharedDatabase } = await import('../src/config/database.js');
const { initializeDatabase } = await import('../src/config/initializeDatabase.js');
const database = getSharedDatabase();

let server;
let baseUrl;
let wargaToken;
let secondWargaToken;
let adminToken;
let wargaId;
let adminId;
let categoryId;
let reportId;

const wargaPassword = 'WargaTest123!';
const adminPassword = 'AdminTest123!';

function jsonRequest(path, { token, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function multipartRequest(path, { token, fields = {}, photoName = 'report.jpg', photoData } = {}) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.append(key, String(value));
  }
  if (photoName) {
    const data = photoData || Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    body.append('photo', new Blob([data], { type: 'image/jpeg' }), photoName);
  }
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return fetch(`${baseUrl}${path}`, { method: 'POST', headers, body });
}

async function responseJson(response) {
  return response.json();
}

async function assertApiError(response, status) {
  assert.equal(response.status, status);
  const result = await responseJson(response);
  assert.equal(typeof result.error?.message, 'string');
  return result;
}

async function createReport({ token = wargaToken, title = 'Laporan Uji Jalan Rusak', urgency = 'tinggi' } = {}) {
  const response = await multipartRequest('/reports', {
    token,
    fields: {
      category_id: categoryId,
      title,
      description: 'Permukaan jalan rusak dan membahayakan pengguna jalan.',
      location_name: 'Jalan Merdeka dekat taman',
      urgency,
      latitude: '-6.2',
      longitude: '106.8',
    },
  });
  assert.equal(response.status, 201);
  return (await responseJson(response)).data;
}

before(async () => {
  await initializeDatabase();

  assert.equal(
    database
      .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'users'")
      .get().count,
    1,
    'serverless entry point initializes the database schema',
  );
  assert.equal(
    database.prepare('SELECT COUNT(*) AS count FROM categories').get().count,
    4,
    'serverless entry point initializes the default categories',
  );
  assert.equal(
    database
      .prepare('SELECT role FROM users WHERE email = ? COLLATE NOCASE')
      .get('warga@example.com').role,
    'warga',
    'serverless startup seeds the demo resident',
  );
  assert.equal(
    database
      .prepare('SELECT role FROM users WHERE email = ? COLLATE NOCASE')
      .get('admin@example.com').role,
    'admin',
    'serverless startup seeds the demo admin',
  );

  const passwordHash = await bcrypt.hash(wargaPassword, 4);
  const adminPasswordHash = await bcrypt.hash(adminPassword, 4);
  const insertUser = database.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
  );
  wargaId = Number(insertUser.run('Warga Uji', 'warga@test.local', passwordHash, 'warga').lastInsertRowid);
  adminId = Number(insertUser.run('Admin Uji', 'admin@test.local', adminPasswordHash, 'admin').lastInsertRowid);
  assert.equal(
    database
      .prepare('SELECT COUNT(*) AS count FROM users WHERE email = ? COLLATE NOCASE')
      .get(process.env.BOOTSTRAP_ADMIN_EMAIL).count,
    1,
    'serverless startup seeds the configured admin idempotently',
  );
  categoryId = database
    .prepare("SELECT id FROM categories WHERE name = 'Jalan Rusak'")
    .get().id;

  server = await new Promise((resolveServer) => {
    const listeningServer = app.listen(0, () => resolveServer(listeningServer));
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
});

after(async () => {
  if (server) {
    await new Promise((resolveClose, rejectClose) => {
      server.close((error) => (error ? rejectClose(error) : resolveClose()));
    });
  }
  database.close();
  rmSync(testDirectory, { recursive: true, force: true });
});

test('SuaraKita backend API integration', async (t) => {
  await t.test('health check, not-found, and error responses', async () => {
    assert.equal(app.get('trust proxy'), 1);

    const rootResponse = await fetch(baseUrl.replace('/api/v1', '/'), {
      redirect: 'manual',
    });
    assert.equal(rootResponse.status, 302);
    assert.equal(rootResponse.headers.get('location'), '/api/v1/health');

    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.status, 200);
    assert.deepEqual((await responseJson(healthResponse)).data, {
      status: 'ok',
      service: 'SuaraKita API',
    });

    const corsResponse = await fetch(`${baseUrl}/health`, {
      headers: { Origin: 'https://suarakita-frontend.example.test' },
    });
    assert.equal(
      corsResponse.headers.get('access-control-allow-origin'),
      'https://suarakita-frontend.example.test',
    );

    const deployedFrontendCorsResponse = await fetch(`${baseUrl}/health`, {
      headers: { Origin: 'https://suarakita-frontend.vercel.app' },
    });
    assert.equal(
      deployedFrontendCorsResponse.headers.get('access-control-allow-origin'),
      'https://suarakita-frontend.vercel.app',
    );

    const preflightResponse = await fetch(`${baseUrl}/reports`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://suarakita-frontend.example.test',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    assert.equal(preflightResponse.status, 204);
    assert.equal(
      preflightResponse.headers.get('access-control-allow-origin'),
      'https://suarakita-frontend.example.test',
    );
    assert.match(
      preflightResponse.headers.get('access-control-allow-headers'),
      /authorization/i,
    );
    assert.match(
      preflightResponse.headers.get('access-control-allow-methods'),
      /POST/i,
    );

    const deniedCorsResponse = await fetch(`${baseUrl}/health`, {
      headers: { Origin: 'https://untrusted.example.test' },
    });
    assert.equal(deniedCorsResponse.headers.get('access-control-allow-origin'), null);

    const redirectedHealthResponse = await fetch(baseUrl.replace('/api/v1', '/'));
    assert.equal(redirectedHealthResponse.status, 200);
    assert.equal((await responseJson(redirectedHealthResponse)).data.status, 'ok');

    const missingEndpoint = await fetch(`${baseUrl}/path-tidak-tersedia`);
    await assertApiError(missingEndpoint, 404);

    const invalidJson = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":',
    });
    await assertApiError(invalidJson, 400);
  });

  await t.test('registration, login, authentication, and profile endpoints', async () => {
    const invalidRegistration = await jsonRequest('/auth/register', {
      method: 'POST',
      body: { name: 'x', email: 'bukan-email', password: 'short' },
    });
    await assertApiError(invalidRegistration, 400);

    const registration = await jsonRequest('/auth/register', {
      method: 'POST',
      body: {
        name: 'Warga Kedua',
        email: 'warga.kedua@test.local',
        password: 'PasswordKedua123!',
        role: 'admin',
      },
    });
    assert.equal(registration.status, 201);
    const registered = (await responseJson(registration)).data;
    assert.equal(registered.user.role, 'warga');
    secondWargaToken = registered.token;

    const duplicateRegistration = await jsonRequest('/auth/register', {
      method: 'POST',
      body: {
        name: 'Warga Duplikat',
        email: 'WARGA.KEDUA@test.local',
        password: 'PasswordKedua123!',
      },
    });
    await assertApiError(duplicateRegistration, 409);

    const wargaLogin = await jsonRequest('/auth/login', {
      method: 'POST',
      body: { email: 'warga@test.local', password: wargaPassword },
    });
    assert.equal(wargaLogin.status, 200);
    wargaToken = (await responseJson(wargaLogin)).data.token;

    const adminLogin = await jsonRequest('/auth/login', {
      method: 'POST',
      body: { email: 'admin@test.local', password: adminPassword },
    });
    assert.equal(adminLogin.status, 200);
    adminToken = (await responseJson(adminLogin)).data.token;

    const bootstrapAdminLogin = await jsonRequest('/auth/login', {
      method: 'POST',
      body: {
        email: process.env.BOOTSTRAP_ADMIN_EMAIL,
        password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
      },
    });
    assert.equal(bootstrapAdminLogin.status, 200);
    assert.equal(
      (await responseJson(bootstrapAdminLogin)).data.user.role,
      'admin',
    );

    const demoResidentLogin = await jsonRequest('/auth/login', {
      method: 'POST',
      body: { email: 'warga@example.com', password: 'WargaDemo123!' },
    });
    assert.equal(demoResidentLogin.status, 200);
    assert.equal((await responseJson(demoResidentLogin)).data.user.role, 'warga');

    const demoAdminLogin = await jsonRequest('/auth/login', {
      method: 'POST',
      body: { email: 'admin@example.com', password: 'AdminDemo123!' },
    });
    assert.equal(demoAdminLogin.status, 200);
    assert.equal((await responseJson(demoAdminLogin)).data.user.role, 'admin');

    const wrongPassword = await jsonRequest('/auth/login', {
      method: 'POST',
      body: { email: 'warga@test.local', password: 'salah' },
    });
    await assertApiError(wrongPassword, 401);

    await assertApiError(await jsonRequest('/auth/me'), 401);
    await assertApiError(
      await jsonRequest('/auth/me', { token: 'token-tidak-valid' }),
      401,
    );

    const me = await jsonRequest('/auth/me', { token: wargaToken });
    assert.equal(me.status, 200);
    assert.equal((await responseJson(me)).data.user.email, 'warga@test.local');

    const profile = await jsonRequest('/users/me', { token: wargaToken });
    assert.equal(profile.status, 200);
    assert.equal((await responseJson(profile)).data.id, wargaId);

    const changedProfile = await jsonRequest('/users/me', {
      token: wargaToken,
      method: 'PATCH',
      body: { name: 'Warga Uji Diperbarui' },
    });
    assert.equal((await responseJson(changedProfile)).data.name, 'Warga Uji Diperbarui');

    await assertApiError(
      await jsonRequest('/users/me', {
        token: wargaToken,
        method: 'PATCH',
        body: { new_password: 'PasswordBaru123!' },
      }),
      400,
    );
    await assertApiError(
      await jsonRequest('/users/me', {
        token: wargaToken,
        method: 'PATCH',
        body: { current_password: 'salah', new_password: 'PasswordBaru123!' },
      }),
      400,
    );

    const updatedPassword = await jsonRequest('/users/me', {
      token: wargaToken,
      method: 'PATCH',
      body: { current_password: wargaPassword, new_password: 'PasswordBaru123!' },
    });
    assert.equal(updatedPassword.status, 200);
    assert.equal(
      (await jsonRequest('/auth/login', {
        method: 'POST',
        body: { email: 'warga@test.local', password: 'PasswordBaru123!' },
      })).status,
      200,
    );

    await assertApiError(await jsonRequest('/users', { token: wargaToken }), 403);
    const users = await jsonRequest('/users?page=1&limit=2', { token: adminToken });
    assert.equal(users.status, 200);
    const userList = await responseJson(users);
    assert.equal(userList.data.length, 2);
    assert.equal(userList.pagination.limit, 2);
    assert.equal(typeof userList.data[0].password_hash, 'undefined');

    const logout = await jsonRequest('/auth/logout', { token: wargaToken, method: 'POST' });
    assert.equal(logout.status, 200);
  });

  await t.test('category listing, authorization, CRUD, and conflict handling', async () => {
    const publicCategories = await jsonRequest('/categories');
    assert.equal(publicCategories.status, 200);
    assert.ok((await responseJson(publicCategories)).data.some((item) => item.id === categoryId));
    await assertApiError(
      await jsonRequest('/categories', {
        token: wargaToken,
        method: 'POST',
        body: { name: 'Warga Tidak Boleh' },
      }),
      403,
    );

    const created = await jsonRequest('/categories', {
      token: adminToken,
      method: 'POST',
      body: { name: 'Kategori Uji', description: 'Kategori sementara' },
    });
    assert.equal(created.status, 201);
    const temporaryCategoryId = (await responseJson(created)).data.id;

    await assertApiError(
      await jsonRequest('/categories', {
        token: adminToken,
        method: 'POST',
        body: { name: 'Kategori Uji' },
      }),
      409,
    );

    const inactive = await jsonRequest(`/categories/${temporaryCategoryId}`, {
      token: adminToken,
      method: 'PATCH',
      body: { description: 'Tidak aktif', is_active: false },
    });
    assert.equal((await responseJson(inactive)).data.is_active, 0);
    const categoriesForPublic = await responseJson(await jsonRequest('/categories'));
    assert.equal(categoriesForPublic.data.some((item) => item.id === temporaryCategoryId), false);
    const categoriesForAdmin = await responseJson(
      await jsonRequest('/categories', { token: adminToken }),
    );
    assert.equal(categoriesForAdmin.data.some((item) => item.id === temporaryCategoryId), true);

    const categoryDetail = await jsonRequest(`/categories/${temporaryCategoryId}`);
    assert.equal(categoryDetail.status, 200);
    await assertApiError(await jsonRequest('/categories/99999'), 404);

    const reactivated = await jsonRequest(`/categories/${temporaryCategoryId}`, {
      token: adminToken,
      method: 'PATCH',
      body: { name: 'Kategori Uji Diperbarui', is_active: 1 },
    });
    assert.equal((await responseJson(reactivated)).data.is_active, 1);

    const deleted = await jsonRequest(`/categories/${temporaryCategoryId}`, {
      token: adminToken,
      method: 'DELETE',
    });
    assert.equal(deleted.status, 200);
  });

  await t.test('report upload, validation, listing, filtering, and update', async () => {
    const noPhoto = await multipartRequest('/reports', {
      token: wargaToken,
      photoName: null,
      fields: { category_id: categoryId, title: 'Laporan tanpa foto' },
    });
    await assertApiError(noPhoto, 400);

    const invalidPhoto = await multipartRequest('/reports', {
      token: wargaToken,
      photoName: 'bukan-foto.txt',
      fields: { category_id: categoryId, title: 'Laporan dengan file salah' },
    });
    await assertApiError(invalidPhoto, 400);

    await assertApiError(
      await multipartRequest('/reports', {
        token: wargaToken,
        fields: { category_id: categoryId, title: 'x' },
      }),
      400,
    );
    await assertApiError(
      await multipartRequest('/reports', {
        token: adminToken,
        fields: { category_id: categoryId, title: 'Laporan admin' },
      }),
      403,
    );
    await assertApiError(
      await multipartRequest('/reports', {
        fields: { category_id: categoryId, title: 'Tanpa autentikasi' },
      }),
      401,
    );

    const created = await createReport();
    reportId = created.id;
    assert.equal(created.status, 'diajukan');
    assert.equal(created.priority_score, 45);
    assert.equal(created.support_count, 0);
    await assertApiError(
      await jsonRequest(`/categories/${categoryId}`, {
        token: adminToken,
        method: 'DELETE',
      }),
      409,
    );

    const defaultUrgencyReport = await createReport({
      title: 'Laporan untuk hapus oleh pemilik',
      urgency: 'sedang',
    });
    assert.equal(defaultUrgencyReport.priority_score, 30);

    const list = await jsonRequest('/reports?q=jalan&status=diajukan&sort=title&order=asc&page=1&limit=1', {
      token: wargaToken,
    });
    assert.equal(list.status, 200);
    const listing = await responseJson(list);
    assert.equal(listing.pagination.limit, 1);
    assert.ok(listing.pagination.total >= 2);
    assert.equal(typeof listing.data[0].is_supported_by_me, 'boolean');

    const filtered = await responseJson(
      await jsonRequest(`/reports?category_id=${categoryId}&urgency=tinggi`),
    );
    assert.ok(filtered.data.some((item) => item.id === reportId));
    await assertApiError(await jsonRequest('/reports?sort=untrusted'), 400);
    await assertApiError(await jsonRequest('/reports?page=0'), 400);

    const detail = await jsonRequest(`/reports/${reportId}`, { token: wargaToken });
    assert.equal(detail.status, 200);
    const reportDetail = (await responseJson(detail)).data;
    assert.equal(reportDetail.history[0].new_status, 'diajukan');

    const photoResponse = await fetch(`${baseUrl}/reports/${reportId}/photo`);
    assert.equal(photoResponse.status, 200);
    assert.match(photoResponse.headers.get('content-type'), /image\/jpeg/);

    const previousPhotoPath = reportDetail.photo_path;
    const newPhoto = new FormData();
    newPhoto.append(
      'photo',
      new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
      'new-photo.jpg',
    );
    const changedPhotoResponse = await fetch(`${baseUrl}/reports/${reportId}/photo`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${wargaToken}` },
      body: newPhoto,
    });
    assert.equal(changedPhotoResponse.status, 200);
    const changedPhoto = (await responseJson(changedPhotoResponse)).data;
    assert.notEqual(changedPhoto.photo_path, previousPhotoPath);
    assert.equal(existsSync(join(process.env.UPLOAD_DIR, previousPhotoPath)), false);

    const changedReport = await jsonRequest(`/reports/${reportId}`, {
      token: wargaToken,
      method: 'PATCH',
      body: { title: 'Judul Laporan Diubah', urgency: 'kritis' },
    });
    assert.equal(changedReport.status, 200);
    assert.equal((await responseJson(changedReport)).data.priority_score, 60);

    await assertApiError(
      await jsonRequest(`/reports/${reportId}`, {
        token: secondWargaToken,
        method: 'PATCH',
        body: { title: 'Tidak berhak mengedit' },
      }),
      403,
    );
    await assertApiError(await jsonRequest('/reports/99999'), 404);
    await assertApiError(await fetch(`${baseUrl}/reports/99999/photo`), 404);
    await assertApiError(await jsonRequest('/reports/99999/history'), 404);
  });

  await t.test('support actions preserve unique support and priority score', async () => {
    await assertApiError(
      await jsonRequest(`/reports/${reportId}/supports`, {
        token: wargaToken,
        method: 'POST',
      }),
      403,
    );

    const added = await jsonRequest(`/reports/${reportId}/supports`, {
      token: secondWargaToken,
      method: 'POST',
    });
    assert.equal(added.status, 201);
    const addedData = (await responseJson(added)).data;
    assert.equal(addedData.support_count, 1);
    assert.equal(addedData.priority_score, 62);

    await assertApiError(
      await jsonRequest(`/reports/${reportId}/supports`, {
        token: secondWargaToken,
        method: 'POST',
      }),
      409,
    );

    const supports = await jsonRequest(`/reports/${reportId}/supports`);
    assert.equal((await responseJson(supports)).data.count, 1);
    const supportedReport = await responseJson(
      await jsonRequest('/reports?sort=title&order=asc', { token: secondWargaToken }),
    );
    assert.equal(
      supportedReport.data.find((item) => item.id === reportId).is_supported_by_me,
      true,
    );

    const removed = await jsonRequest(`/reports/${reportId}/supports/me`, {
      token: secondWargaToken,
      method: 'DELETE',
    });
    assert.equal((await responseJson(removed)).data.priority_score, 60);
    await assertApiError(
      await jsonRequest(`/reports/${reportId}/supports/me`, {
        token: secondWargaToken,
        method: 'DELETE',
      }),
      404,
    );
  });

  await t.test('admin status/urgency changes, history, and terminal rules', async () => {
    await assertApiError(
      await jsonRequest(`/reports/${reportId}/status`, {
        token: wargaToken,
        method: 'PATCH',
        body: { status: 'diproses' },
      }),
      403,
    );

    const urgency = await jsonRequest(`/reports/${reportId}/urgency`, {
      token: adminToken,
      method: 'PATCH',
      body: { urgency: 'sedang' },
    });
    assert.equal(urgency.status, 200);
    assert.equal((await responseJson(urgency)).data.priority_score, 30);
    await assertApiError(
      await jsonRequest(`/reports/${reportId}/urgency`, {
        token: adminToken,
        method: 'PATCH',
        body: { urgency: 'darurat' },
      }),
      400,
    );

    const progressed = await jsonRequest(`/reports/${reportId}/status`, {
      token: adminToken,
      method: 'PATCH',
      body: { status: 'diproses', note: 'Penanganan dimulai.' },
    });
    assert.equal(progressed.status, 200);
    assert.equal((await responseJson(progressed)).data.status, 'diproses');
    await assertApiError(
      await jsonRequest(`/reports/${reportId}/status`, {
        token: adminToken,
        method: 'PATCH',
        body: { status: 'diverifikasi' },
      }),
      409,
    );
    await assertApiError(
      await jsonRequest(`/reports/${reportId}/status`, {
        token: adminToken,
        method: 'PATCH',
        body: { status: 'diproses' },
      }),
      409,
    );

    const finished = await jsonRequest(`/reports/${reportId}/status`, {
      token: adminToken,
      method: 'PATCH',
      body: { status: 'selesai', note: 'Pekerjaan selesai.' },
    });
    assert.equal(finished.status, 200);
    await assertApiError(
      await jsonRequest(`/reports/${reportId}/status`, {
        token: adminToken,
        method: 'PATCH',
        body: { status: 'ditolak' },
      }),
      409,
    );
    await assertApiError(
      await jsonRequest(`/reports/${reportId}/supports`, {
        token: secondWargaToken,
        method: 'POST',
      }),
      400,
    );
    await assertApiError(
      await jsonRequest(`/reports/${reportId}`, {
        token: wargaToken,
        method: 'PATCH',
        body: { title: 'Tidak bisa diubah lagi' },
      }),
      403,
    );

    const historyResponse = await jsonRequest(`/reports/${reportId}/history`);
    assert.equal(historyResponse.status, 200);
    const history = (await responseJson(historyResponse)).data;
    assert.deepEqual(history.map((item) => item.new_status), ['diajukan', 'diproses', 'selesai']);
    assert.equal(history[1].changed_by, adminId);
    assert.equal(history[1].note, 'Penanganan dimulai.');
  });

  await t.test('dashboard endpoints are admin-only and return consistent aggregates', async () => {
    for (const endpoint of ['/dashboard/summary', '/dashboard/by-category', '/dashboard/by-status', '/dashboard/priority']) {
      await assertApiError(await jsonRequest(endpoint, { token: wargaToken }), 403);
    }

    const summaryResponse = await jsonRequest('/dashboard/summary', { token: adminToken });
    assert.equal(summaryResponse.status, 200);
    const summary = (await responseJson(summaryResponse)).data;
    assert.ok(summary.total_reports >= 2);
    assert.ok(summary.completed_reports >= 1);
    assert.ok(summary.total_users >= 3);

    const byCategory = await jsonRequest('/dashboard/by-category', { token: adminToken });
    assert.equal(byCategory.status, 200);
    assert.ok((await responseJson(byCategory)).data.some((item) => item.category_id === categoryId));

    const byStatus = await jsonRequest('/dashboard/by-status', { token: adminToken });
    const statusData = (await responseJson(byStatus)).data;
    assert.equal(statusData.length, 5);
    assert.ok(statusData.some((item) => item.status === 'selesai' && item.count >= 1));

    const priority = await jsonRequest('/dashboard/priority?limit=2', { token: adminToken });
    const priorityData = (await responseJson(priority)).data;
    assert.ok(priorityData.length <= 2);
    assert.ok(priorityData.every((item, index) => index === 0 || priorityData[index - 1].priority_score >= item.priority_score));
  });

  await t.test('report deletion enforces ownership and removes uploaded photo', async () => {
    await assertApiError(
      await jsonRequest(`/reports/${reportId}`, { token: wargaToken, method: 'DELETE' }),
      403,
    );

    const deletableReport = await createReport({ title: 'Laporan yang akan dihapus' });
    const photoPath = join(process.env.UPLOAD_DIR, deletableReport.photo_path);
    await assertApiError(
      await jsonRequest(`/reports/${deletableReport.id}`, {
        token: secondWargaToken,
        method: 'DELETE',
      }),
      403,
    );

    const deletion = await jsonRequest(`/reports/${deletableReport.id}`, {
      token: wargaToken,
      method: 'DELETE',
    });
    assert.equal(deletion.status, 200);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM reports WHERE id = ?').get(deletableReport.id).count, 0);
    assert.equal(existsSync(photoPath), false);
  });
});
