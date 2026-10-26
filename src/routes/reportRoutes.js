import { Router } from 'express';
import { reportController } from '../controllers/reportController.js';
import { supportController } from '../controllers/supportController.js';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth.js';
import { uploadPhoto } from '../middleware/upload.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  createReportSchema,
  queryReportsSchema,
  updateReportSchema,
  updateStatusSchema,
  updateUrgencySchema,
} from '../validators/reportValidator.js';

const router = Router();

// 1. Daftar dan Pembuatan Laporan
router.get('/', optionalAuthenticate, validateQuery(queryReportsSchema), reportController.getReports);
router.post(
  '/',
  authenticate,
  authorize('warga'),
  uploadPhoto.single('photo'),
  validateBody(createReportSchema),
  reportController.createReport,
);

// 2. Detail Laporan
router.get('/:id', optionalAuthenticate, reportController.getReportById);

// 3. Modifikasi Laporan oleh Pelapor (Warga)
router.patch(
  '/:id',
  authenticate,
  authorize('warga'),
  validateBody(updateReportSchema),
  reportController.updateReport,
);
router.delete('/:id', authenticate, authorize('warga'), reportController.deleteReport);
router.patch(
  '/:id/photo',
  authenticate,
  authorize('warga'),
  uploadPhoto.single('photo'),
  reportController.updateReportPhoto,
);

// 4. File Foto dan Riwayat
router.get('/:id/photo', reportController.getReportPhoto);
router.get('/:id/history', reportController.getReportHistory);

// 5. Pengelolaan oleh Admin (Status dan Urgensi)
router.patch(
  '/:id/status',
  authenticate,
  authorize('admin'),
  validateBody(updateStatusSchema),
  reportController.updateStatus,
);
router.patch(
  '/:id/urgency',
  authenticate,
  authorize('admin'),
  validateBody(updateUrgencySchema),
  reportController.updateUrgency,
);

// 6. Dukungan Warga (Supports)
router.get('/:id/supports', supportController.getSupports);
router.post('/:id/supports', authenticate, authorize('warga'), supportController.addSupport);
router.delete('/:id/supports/me', authenticate, authorize('warga'), supportController.removeSupport);

export default router;
