import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

const testDir = mkdtempSync(join(tmpdir(), 'suarakita-coverage-test-'));
process.env.NODE_ENV = 'test';
process.env.VERCEL = '1';
process.env.SEED_DEMO_ACCOUNTS = 'false';
process.env.TURSO_DATABASE_URL = 'file::memory:';
process.env.UPLOAD_DIR = join(testDir, 'uploads');
process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-for-integration-tests';

const { getSharedDatabase } = await import('../config/database.js');
const { initializeDatabase } = await import('../config/initializeDatabase.js');
const { categoryRepository } = await import('../repositories/categoryRepository.js');
const { dashboardRepository } = await import('../repositories/dashboardRepository.js');
const { reportRepository } = await import('../repositories/reportRepository.js');
const { statusHistoryRepository } = await import('../repositories/statusHistoryRepository.js');
const { supportRepository } = await import('../repositories/supportRepository.js');
const { userRepository } = await import('../repositories/userRepository.js');
const { authService } = await import('../services/authService.js');
const { categoryService } = await import('../services/categoryService.js');
const { reportService, safeDeleteFile } = await import('../services/reportService.js');
const { supportService } = await import('../services/supportService.js');
const { userService } = await import('../services/userService.js');
import * as databaseModule from '../config/database.js';

let testUser;
let secondUser;
let testCategory;
let testReport;

beforeAll(async () => {
  await initializeDatabase();
  testUser = await userRepository.create({
    name: 'Coverage User',
    email: 'coverage@example.local',
    passwordHash: 'hashed_pw',
    role: 'warga',
  });
  secondUser = await userRepository.create({
    name: 'Second User',
    email: 'second@example.local',
    passwordHash: 'hashed_pw',
    role: 'warga',
  });
  testCategory = await categoryRepository.create({
    name: 'Infrastruktur Jalan',
    description: 'Laporan jalan',
  });
  const reportId = await reportRepository.create({
    userId: testUser.id,
    categoryId: testCategory.id,
    title: 'Jalan Berlubang di Dekat Pasar',
    description: 'Ada lubang besar membahayakan pengendara motor',
    locationName: 'Jl. Pasar Baru',
    photoPath: 'test-photo.jpg',
    urgency: 'sedang',
    priorityScore: 30,
  });
  testReport = await reportRepository.findById(reportId);
});

afterAll(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe('Category Repository & Service coverage branches', () => {
  test('categoryRepository handles null description, active toggle, empty updates, and fallback counts', async () => {
    // description null/undefined fallback
    const cat = await categoryRepository.create({ name: 'Tanpa Deskripsi' });
    expect(cat.description).toBe(null);

    // update is_active to false and true
    const updatedInactive = await categoryRepository.update(cat.id, { is_active: false });
    expect(updatedInactive.is_active).toBe(0);
    const updatedActive = await categoryRepository.update(cat.id, { is_active: true });
    expect(updatedActive.is_active).toBe(1);

    // update with empty fields
    const unchanged = await categoryRepository.update(cat.id, {});
    expect(unchanged.id).toBe(cat.id);

    // countReportsByCategoryId for unused category
    const count = await categoryRepository.countReportsByCategoryId(999999);
    expect(count).toBe(0);

    // queryOne returning null covers row?.total ?? 0 fallback
    const spy = vi.spyOn(databaseModule, 'queryOne').mockResolvedValueOnce(null);
    const fallbackCount = await categoryRepository.countReportsByCategoryId(cat.id);
    expect(fallbackCount).toBe(0);
    spy.mockRestore();
  });

  test('categoryService throws NotFoundError and ConflictError for missing or duplicate items', async () => {
    await expect(categoryService.updateCategory(999999, { name: 'Baru' })).rejects.toThrow(
      'Kategori tidak ditemukan.',
    );

    const catB = await categoryRepository.create({ name: 'Kategori Lain', description: 'Desc' });
    await expect(
      categoryService.updateCategory(catB.id, { name: testCategory.name }),
    ).rejects.toThrow('Kategori dengan nama tersebut sudah ada.');

    await expect(categoryService.deleteCategory(999999)).rejects.toThrow(
      'Kategori tidak ditemukan.',
    );
  });
});

describe('Dashboard Repository branches', () => {
  test('dashboardRepository handles zero/null stats and default limits', async () => {
    // Test getPriorityReports with default/null limit and explicit limit
    const reportsWithDefaultLimit = await dashboardRepository.getPriorityReports(null);
    expect(Array.isArray(reportsWithDefaultLimit)).toBe(true);

    const reportsWithExplicitLimit = await dashboardRepository.getPriorityReports(2);
    expect(Array.isArray(reportsWithExplicitLimit)).toBe(true);

    // Test getSummary with null or zero stats to cover fallback || 0 branches
    const spy = vi.spyOn(databaseModule, 'queryOne')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const summaryWithNulls = await dashboardRepository.getSummary();
    expect(summaryWithNulls.total_reports).toBe(0);
    expect(summaryWithNulls.pending_reports).toBe(0);
    expect(summaryWithNulls.in_progress_reports).toBe(0);
    expect(summaryWithNulls.completed_reports).toBe(0);
    expect(summaryWithNulls.rejected_reports).toBe(0);
    expect(summaryWithNulls.total_users).toBe(0);
    expect(summaryWithNulls.total_supports).toBe(0);
    spy.mockRestore();

    // Test getSummary with all positive counts to cover truthy branches
    const spyPositive = vi.spyOn(databaseModule, 'queryOne')
      .mockResolvedValueOnce({
        total_reports: 10,
        pending_reports: 4,
        in_progress_reports: 3,
        completed_reports: 2,
        rejected_reports: 1,
      })
      .mockResolvedValueOnce({ total_users: 25 })
      .mockResolvedValueOnce({ total_supports: 15 });

    const summaryPositive = await dashboardRepository.getSummary();
    expect(summaryPositive.total_reports).toBe(10);
    expect(summaryPositive.pending_reports).toBe(4);
    expect(summaryPositive.in_progress_reports).toBe(3);
    expect(summaryPositive.completed_reports).toBe(2);
    expect(summaryPositive.rejected_reports).toBe(1);
    expect(summaryPositive.total_users).toBe(25);
    expect(summaryPositive.total_supports).toBe(15);
    spyPositive.mockRestore();
  });
});

describe('User Repository & Service coverage branches', () => {
  test('userRepository handles empty updates', async () => {
    const updated = await userRepository.updateProfile(testUser.id, {});
    expect(updated.id).toBe(testUser.id);
  });

  test('authService and userService handle not found users and pagination edge cases', async () => {
    await expect(authService.getMe(999999)).rejects.toThrow('Pengguna tidak ditemukan.');
    await expect(userService.getProfile(999999)).rejects.toThrow('Pengguna tidak ditemukan.');
    await expect(userService.updateProfile(999999, { name: 'New Name' })).rejects.toThrow(
      'Pengguna tidak ditemukan.',
    );

    // Profile found but user by email not found
    const spyFindById = vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({
      id: 888,
      email: 'ghost@test.local',
    });
    const spyFindByEmail = vi.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce(null);
    await expect(userService.updateProfile(888, { name: 'Ghost' })).rejects.toThrow(
      'Pengguna tidak ditemukan.',
    );
    spyFindById.mockRestore();
    spyFindByEmail.mockRestore();

    // userService.getAllUsers pagination when total is 0
    const spyCount = vi.spyOn(userRepository, 'countAll').mockResolvedValueOnce(0);
    const spyFindAll = vi.spyOn(userRepository, 'findAll').mockResolvedValueOnce([]);
    const emptyResult = await userService.getAllUsers({ page: 1, limit: 10 });
    expect(emptyResult.pagination.total_pages).toBe(0);
    spyCount.mockRestore();
    spyFindAll.mockRestore();
  });
});

describe('Support Repository & Service coverage branches', () => {
  test('supportRepository handles null rows and countByReportId', async () => {
    const spy = vi.spyOn(databaseModule, 'queryOne').mockResolvedValueOnce(null);
    const total = await supportRepository.countByReportId(testReport.id);
    expect(total).toBe(0);
    spy.mockRestore();
  });

  test('supportService throws NotFoundError when report does not exist', async () => {
    await expect(supportService.addSupport(999999, testUser.id)).rejects.toThrow(
      'Laporan tidak ditemukan.',
    );
    await expect(supportService.removeSupport(999999, testUser.id)).rejects.toThrow(
      'Laporan tidak ditemukan.',
    );
    await expect(supportService.getSupports(999999)).rejects.toThrow('Laporan tidak ditemukan.');
  });
});

describe('Report Repository & Service coverage branches', () => {
  test('reportRepository handles fallback sort/order, empty updates, and pagination with 0 records', async () => {
    // empty update fields
    const updated = await reportRepository.update(testReport.id, {});
    expect(updated.id).toBe(testReport.id);

    // unknown sort and unknown order fallback
    const result = await reportRepository.findAll({
      sort: 'invalid_column',
      order: 'INVALID_ORDER',
    });
    expect(Array.isArray(result.data)).toBe(true);

    // pagination when total is 0
    const emptySearch = await reportRepository.findAll({ q: 'tidak_akan_pernah_ada_laporan_ini_12345' });
    expect(emptySearch.pagination.total).toBe(0);
    expect(emptySearch.pagination.total_pages).toBe(0);

    // countRow?.total null fallback
    const spy = vi.spyOn(databaseModule, 'queryOne').mockResolvedValueOnce(null);
    const fallbackSearch = await reportRepository.findAll({});
    expect(fallbackSearch.pagination.total).toBe(0);
    spy.mockRestore();
  });

  test('safeDeleteFile handles null, non-existent, unlink success, and error logging', async () => {
    // null or empty filename
    safeDeleteFile(null);
    safeDeleteFile('');

    // non-existent file
    safeDeleteFile('definitely-not-existent-file-1234.jpg');

    // real file deletion
    const { getUploadDirectory } = await import('../config/uploads.js');
    const { mkdirSync } = await import('node:fs');
    const uploadDirectory = getUploadDirectory();
    if (!existsSync(uploadDirectory)) mkdirSync(uploadDirectory, { recursive: true });
    const tempFile = `temp-delete-test-${Date.now()}.jpg`;
    writeFileSync(join(uploadDirectory, tempFile), 'fake-data');
    expect(existsSync(join(uploadDirectory, tempFile))).toBe(true);
    safeDeleteFile(tempFile);
    expect(existsSync(join(uploadDirectory, tempFile))).toBe(false);

    // unlink error logging (unlinking a directory throws EPERM/EBUSY)
    const spyConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
    const errorDir = `error-dir-${Date.now()}`;
    const errorDirPath = join(uploadDirectory, errorDir);
    mkdirSync(errorDirPath, { recursive: true });
    try {
      safeDeleteFile(errorDir);
      expect(spyConsole).toHaveBeenCalled();
    } finally {
      if (existsSync(errorDirPath)) {
        rmSync(errorDirPath, { recursive: true, force: true });
      }
      spyConsole.mockRestore();
    }
  });

  test('reportService.createReport validates photoFile, category validity, and transaction failures', async () => {
    // missing photoFile
    await expect(
      reportService.createReport({
        userId: testUser.id,
        categoryId: testCategory.id,
        title: 'Judul',
        description: 'Deskripsi',
        locationName: 'Lokasi',
      }),
    ).rejects.toThrow('Foto laporan wajib diunggah.');

    // invalid or inactive category
    const inactiveCat = await categoryRepository.create({ name: 'Inactive Cat' });
    await categoryRepository.update(inactiveCat.id, { is_active: false });
    await expect(
      reportService.createReport({
        userId: testUser.id,
        categoryId: inactiveCat.id,
        title: 'Judul Valid Laporan',
        description: 'Deskripsi panjang lebih dari sepuluh karakter',
        locationName: 'Lokasi',
        photoFile: { filename: 'test-temp.jpg' },
      }),
    ).rejects.toThrow('Kategori yang dipilih tidak valid atau tidak aktif.');

    // transaction failure during creation cleans up photoFile and throws
    const spyTx = vi.spyOn(databaseModule, 'runInTransaction').mockRejectedValueOnce(
      new Error('Transaction exploded'),
    );
    await expect(
      reportService.createReport({
        userId: testUser.id,
        categoryId: testCategory.id,
        title: 'Judul Valid Laporan',
        description: 'Deskripsi panjang lebih dari sepuluh karakter',
        locationName: 'Lokasi',
        photoFile: { filename: 'test-temp-fail.jpg' },
      }),
    ).rejects.toThrow('Transaction exploded');
    spyTx.mockRestore();
  });

  test('reportService.updateReport validates not found, invalid category, and urgency change branches', async () => {
    await expect(reportService.updateReport(999999, testUser.id, {})).rejects.toThrow(
      'Laporan tidak ditemukan.',
    );

    // invalid category (null)
    await expect(
      reportService.updateReport(testReport.id, testUser.id, { category_id: 999999 }),
    ).rejects.toThrow('Kategori yang dipilih tidak valid atau tidak aktif.');

    // inactive category (not null but !is_active)
    const inactiveCategory = await categoryRepository.create({ name: 'Kategori Inaktif' });
    await categoryRepository.update(inactiveCategory.id, { is_active: false });
    await expect(
      reportService.updateReport(testReport.id, testUser.id, { category_id: inactiveCategory.id }),
    ).rejects.toThrow('Kategori yang dipilih tidak valid atau tidak aktif.');

    // active category update
    const updatedCategory = await reportService.updateReport(testReport.id, testUser.id, {
      category_id: testCategory.id,
    });
    expect(updatedCategory.category_id).toBe(testCategory.id);

    // urgency change recalculates priority score
    const updatedUrgency = await reportService.updateReport(testReport.id, testUser.id, {
      urgency: 'kritis',
    });
    expect(updatedUrgency.urgency).toBe('kritis');

    // urgency unchanged
    const unchangedUrgency = await reportService.updateReport(testReport.id, testUser.id, {
      urgency: 'kritis',
    });
    expect(unchangedUrgency.urgency).toBe('kritis');
  });

  test('reportService.updateReportPhoto validates missing photo, ownership, status, null oldPhoto, and error cleanup', async () => {
    // missing photo
    await expect(reportService.updateReportPhoto(testReport.id, testUser.id, null)).rejects.toThrow(
      'Foto baru wajib disertakan.',
    );

    // not found
    await expect(
      reportService.updateReportPhoto(999999, testUser.id, { filename: 'photo.jpg' }),
    ).rejects.toThrow('Laporan tidak ditemukan.');

    // wrong user
    await expect(
      reportService.updateReportPhoto(testReport.id, secondUser.id, { filename: 'photo.jpg' }),
    ).rejects.toThrow('Anda hanya dapat mengubah laporan milik Anda sendiri.');

    // report status !== diajukan
    await reportRepository.update(testReport.id, { status: 'diproses' });
    await expect(
      reportService.updateReportPhoto(testReport.id, testUser.id, { filename: 'photo.jpg' }),
    ).rejects.toThrow('Foto laporan hanya dapat diubah selama masih dalam status "diajukan".');

    // restore status to diajukan
    await reportRepository.update(testReport.id, { status: 'diajukan' });

    // update photo when old photo_path was null (covers if (oldPhoto) false branch)
    const spyFindNullPhoto = vi.spyOn(reportRepository, 'findById').mockResolvedValueOnce({
      ...testReport,
      photo_path: null,
    });
    const photoUpdated = await reportService.updateReportPhoto(testReport.id, testUser.id, {
      filename: 'new-photo-for-null.jpg',
    });
    expect(photoUpdated).toBeDefined();
    spyFindNullPhoto.mockRestore();

    // error in reportRepository.update cleans up photo and rethrows
    const spyUpdate = vi.spyOn(reportRepository, 'update').mockRejectedValueOnce(
      new Error('Update failed on disk'),
    );
    await expect(
      reportService.updateReportPhoto(testReport.id, testUser.id, { filename: 'temp-err.jpg' }),
    ).rejects.toThrow('Update failed on disk');
    spyUpdate.mockRestore();
  });

  test('reportService delete handles null oldPhoto branch', async () => {
    // delete report with photo_path null (covers if (oldPhoto) false branch)
    const spyFindNullPhoto2 = vi.spyOn(reportRepository, 'findById').mockResolvedValueOnce({
      ...testReport,
      photo_path: null,
    });
    const spyDelete2 = vi.spyOn(reportRepository, 'delete').mockResolvedValueOnce(true);
    const deleted = await reportService.deleteReport(testReport.id, testUser.id);
    expect(deleted).toBe(true);
    spyFindNullPhoto2.mockRestore();
    spyDelete2.mockRestore();
  });

  test('reportService updateStatus handles unknown current status and note fallbacks', async () => {
    // unknown status in ALLOWED_STATUS_TRANSITIONS fallback to []
    const spyReport = vi.spyOn(reportRepository, 'findById').mockResolvedValueOnce({
      id: testReport.id,
      status: 'custom_unknown_status',
    });
    await expect(
      reportService.updateStatus(testReport.id, testUser.id, { status: 'selesai' }),
    ).rejects.toThrow('Transisi status dari "custom_unknown_status" ke "selesai" tidak diizinkan.');
    spyReport.mockRestore();

    // note null/undefined fallback branch
    await reportRepository.update(testReport.id, { status: 'diajukan' });
    const verified = await reportService.updateStatus(testReport.id, testUser.id, {
      status: 'diverifikasi',
      note: undefined,
    });
    expect(verified.status).toBe('diverifikasi');

    // note truthy branch
    const processing = await reportService.updateStatus(testReport.id, testUser.id, {
      status: 'diproses',
      note: 'Sedang dikerjakan oleh tim teknis',
    });
    expect(processing.status).toBe('diproses');
  });

  test('reportService delete, status, urgency, and photo path validations for not found', async () => {
    await expect(reportService.deleteReport(999999, testUser.id)).rejects.toThrow(
      'Laporan tidak ditemukan.',
    );

    await expect(
      reportService.updateStatus(999999, testUser.id, { status: 'diverifikasi' }),
    ).rejects.toThrow('Laporan tidak ditemukan.');

    await expect(reportService.updateUrgency(999999, { urgency: 'tinggi' })).rejects.toThrow(
      'Laporan tidak ditemukan.',
    );

    await expect(reportService.getPhotoFilePath(999999)).rejects.toThrow(
      'Laporan tidak ditemukan.',
    );

    // getPhotoFilePath when photo does not exist on disk
    await expect(reportService.getPhotoFilePath(testReport.id)).rejects.toThrow(
      'File foto tidak ditemukan pada server penyimpanan.',
    );
  });
});
