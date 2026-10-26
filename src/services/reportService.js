import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { getSharedDatabase } from '../config/database.js';
import { categoryRepository } from '../repositories/categoryRepository.js';
import { reportRepository } from '../repositories/reportRepository.js';
import { statusHistoryRepository } from '../repositories/statusHistoryRepository.js';
import { supportRepository } from '../repositories/supportRepository.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';
import { calculatePriorityScore } from '../utils/priority.js';

const uploadDir = resolve(process.env.UPLOAD_DIR || './uploads');

// Transisi status yang sah sesuai AGENTS.md dan README
const ALLOWED_STATUS_TRANSITIONS = {
  diajukan: ['diverifikasi', 'diproses', 'selesai', 'ditolak'],
  diverifikasi: ['diproses', 'selesai', 'ditolak'],
  diproses: ['selesai', 'ditolak'],
  selesai: [],
  ditolak: [],
};

function safeDeleteFile(filename) {
  if (!filename) return;
  try {
    const filePath = resolve(uploadDir, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`Gagal menghapus file: ${filename}`, err);
  }
}

export const reportService = {
  async getReports(params, currentUserId = null) {
    return reportRepository.findAll({ ...params, currentUserId });
  },

  async getReportById(id, currentUserId = null) {
    const report = reportRepository.findById(id, currentUserId);
    if (!report) {
      throw new NotFoundError('Laporan tidak ditemukan.');
    }
    const history = statusHistoryRepository.findByReportId(id);
    return {
      ...report,
      history,
    };
  },

  async createReport({
    userId,
    categoryId,
    title,
    description,
    locationName,
    latitude,
    longitude,
    urgency,
    photoFile,
  }) {
    if (!photoFile) {
      throw new BadRequestError('Foto laporan wajib diunggah.');
    }

    const category = categoryRepository.findById(categoryId);
    if (!category || !category.is_active) {
      safeDeleteFile(photoFile.filename);
      throw new BadRequestError('Kategori yang dipilih tidak valid atau tidak aktif.');
    }

    const db = getSharedDatabase();
    const initialUrgency = urgency || 'sedang';
    const initialPriorityScore = calculatePriorityScore(initialUrgency, 0);

    const runTransaction = db.transaction(() => {
      const reportId = reportRepository.create(
        {
          userId,
          categoryId,
          title,
          description,
          locationName,
          latitude,
          longitude,
          photoPath: photoFile.filename,
          urgency: initialUrgency,
          priorityScore: initialPriorityScore,
        },
        db,
      );

      statusHistoryRepository.create(
        {
          reportId,
          changedBy: userId,
          oldStatus: null,
          newStatus: 'diajukan',
          note: 'Laporan dibuat oleh pelapor.',
        },
        db,
      );

      return reportId;
    });

    try {
      const createdId = runTransaction();
      return this.getReportById(createdId, userId);
    } catch (error) {
      safeDeleteFile(photoFile.filename);
      throw error;
    }
  },

  async updateReport(id, userId, fields) {
    const report = reportRepository.findById(id);
    if (!report) {
      throw new NotFoundError('Laporan tidak ditemukan.');
    }

    if (report.user_id !== userId) {
      throw new ForbiddenError('Anda hanya dapat mengubah laporan milik Anda sendiri.');
    }

    if (report.status !== 'diajukan') {
      throw new ForbiddenError(
        'Laporan hanya dapat diubah selama masih dalam status "diajukan".',
      );
    }

    if (fields.category_id) {
      const category = categoryRepository.findById(fields.category_id);
      if (!category || !category.is_active) {
        throw new BadRequestError('Kategori yang dipilih tidak valid atau tidak aktif.');
      }
    }

    const db = getSharedDatabase();
    const updateData = { ...fields };

    // Jika urgensi diubah oleh pemilik
    if (fields.urgency && fields.urgency !== report.urgency) {
      const supportCount = supportRepository.countByReportId(id, db);
      updateData.priority_score = calculatePriorityScore(fields.urgency, supportCount);
    }

    reportRepository.update(id, updateData, db);
    return this.getReportById(id, userId);
  },

  async updateReportPhoto(id, userId, newPhotoFile) {
    if (!newPhotoFile) {
      throw new BadRequestError('Foto baru wajib disertakan.');
    }

    const report = reportRepository.findById(id);
    if (!report) {
      safeDeleteFile(newPhotoFile.filename);
      throw new NotFoundError('Laporan tidak ditemukan.');
    }

    if (report.user_id !== userId) {
      safeDeleteFile(newPhotoFile.filename);
      throw new ForbiddenError('Anda hanya dapat mengubah laporan milik Anda sendiri.');
    }

    if (report.status !== 'diajukan') {
      safeDeleteFile(newPhotoFile.filename);
      throw new ForbiddenError(
        'Foto laporan hanya dapat diubah selama masih dalam status "diajukan".',
      );
    }

    const oldPhoto = report.photo_path;
    try {
      reportRepository.update(id, { photo_path: newPhotoFile.filename });
      if (oldPhoto) {
        safeDeleteFile(oldPhoto);
      }
      return this.getReportById(id, userId);
    } catch (err) {
      safeDeleteFile(newPhotoFile.filename);
      throw err;
    }
  },

  async deleteReport(id, userId) {
    const report = reportRepository.findById(id);
    if (!report) {
      throw new NotFoundError('Laporan tidak ditemukan.');
    }

    if (report.user_id !== userId) {
      throw new ForbiddenError('Anda hanya dapat menghapus laporan milik Anda sendiri.');
    }

    if (report.status !== 'diajukan') {
      throw new ForbiddenError(
        'Laporan hanya dapat dihapus selama masih dalam status "diajukan".',
      );
    }

    const oldPhoto = report.photo_path;
    reportRepository.delete(id);
    if (oldPhoto) {
      safeDeleteFile(oldPhoto);
    }

    return true;
  },

  async updateStatus(id, adminId, { status: newStatus, note }) {
    const report = reportRepository.findById(id);
    if (!report) {
      throw new NotFoundError('Laporan tidak ditemukan.');
    }

    if (report.status === newStatus) {
      throw new ConflictError(`Laporan sudah berada dalam status "${newStatus}".`);
    }

    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[report.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new ConflictError(
        `Transisi status dari "${report.status}" ke "${newStatus}" tidak diizinkan.`,
      );
    }

    const db = getSharedDatabase();
    const runTransaction = db.transaction(() => {
      reportRepository.update(id, { status: newStatus }, db);
      statusHistoryRepository.create(
        {
          reportId: id,
          changedBy: adminId,
          oldStatus: report.status,
          newStatus,
          note: note || null,
        },
        db,
      );
    });

    runTransaction();
    return this.getReportById(id);
  },

  async updateUrgency(id, { urgency: newUrgency }) {
    const report = reportRepository.findById(id);
    if (!report) {
      throw new NotFoundError('Laporan tidak ditemukan.');
    }

    const db = getSharedDatabase();
    const supportCount = supportRepository.countByReportId(id, db);
    const newPriorityScore = calculatePriorityScore(newUrgency, supportCount);

    reportRepository.update(
      id,
      {
        urgency: newUrgency,
        priority_score: newPriorityScore,
      },
      db,
    );

    return this.getReportById(id);
  },

  async getReportHistory(id) {
    const report = reportRepository.findById(id);
    if (!report) {
      throw new NotFoundError('Laporan tidak ditemukan.');
    }
    return statusHistoryRepository.findByReportId(id);
  },

  async getPhotoFilePath(id) {
    const report = reportRepository.findById(id);
    if (!report) {
      throw new NotFoundError('Laporan tidak ditemukan.');
    }

    const filePath = resolve(uploadDir, report.photo_path);
    if (!existsSync(filePath)) {
      throw new NotFoundError('File foto tidak ditemukan pada server penyimpanan.');
    }

    return filePath;
  },
};
