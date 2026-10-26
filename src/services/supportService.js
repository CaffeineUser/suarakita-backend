import { getSharedDatabase } from '../config/database.js';
import { reportRepository } from '../repositories/reportRepository.js';
import { supportRepository } from '../repositories/supportRepository.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';
import { calculatePriorityScore } from '../utils/priority.js';

export const supportService = {
  async addSupport(reportId, userId) {
    const report = reportRepository.findById(reportId);
    if (!report) {
      throw new NotFoundError('Laporan tidak ditemukan.');
    }

    if (report.user_id === userId) {
      throw new ForbiddenError('Anda tidak dapat memberikan dukungan pada laporan milik sendiri.');
    }

    if (['selesai', 'ditolak'].includes(report.status)) {
      throw new BadRequestError(
        `Laporan yang berstatus "${report.status}" tidak dapat menerima dukungan baru.`,
      );
    }

    const existingSupport = supportRepository.findUserSupport(reportId, userId);
    if (existingSupport) {
      throw new ConflictError('Anda sudah memberikan dukungan untuk laporan ini.');
    }

    const db = getSharedDatabase();
    let newSupportCount = 0;
    let newPriorityScore = 0;

    const runTransaction = db.transaction(() => {
      supportRepository.create(reportId, userId, db);
      newSupportCount = supportRepository.countByReportId(reportId, db);
      newPriorityScore = calculatePriorityScore(report.urgency, newSupportCount);
      reportRepository.update(
        reportId,
        {
          priority_score: newPriorityScore,
        },
        db,
      );
    });

    runTransaction();

    return {
      message: 'Dukungan berhasil ditambahkan.',
      support_count: newSupportCount,
      priority_score: newPriorityScore,
    };
  },

  async removeSupport(reportId, userId) {
    const report = reportRepository.findById(reportId);
    if (!report) {
      throw new NotFoundError('Laporan tidak ditemukan.');
    }

    const existingSupport = supportRepository.findUserSupport(reportId, userId);
    if (!existingSupport) {
      throw new NotFoundError('Anda belum memberikan dukungan untuk laporan ini.');
    }

    const db = getSharedDatabase();
    let newSupportCount = 0;
    let newPriorityScore = 0;

    const runTransaction = db.transaction(() => {
      supportRepository.delete(reportId, userId, db);
      newSupportCount = supportRepository.countByReportId(reportId, db);
      newPriorityScore = calculatePriorityScore(report.urgency, newSupportCount);
      reportRepository.update(
        reportId,
        {
          priority_score: newPriorityScore,
        },
        db,
      );
    });

    runTransaction();

    return {
      message: 'Dukungan berhasil dibatalkan.',
      support_count: newSupportCount,
      priority_score: newPriorityScore,
    };
  },

  async getSupports(reportId) {
    const report = reportRepository.findById(reportId);
    if (!report) {
      throw new NotFoundError('Laporan tidak ditemukan.');
    }

    const supports = supportRepository.findByReportId(reportId);
    return {
      count: supports.length,
      supports,
    };
  },
};
