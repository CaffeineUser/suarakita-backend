import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/summary', dashboardController.getSummary);
router.get('/by-category', dashboardController.getByCategory);
router.get('/by-status', dashboardController.getByStatus);
router.get('/priority', dashboardController.getPriorityReports);

export default router;
