import { Router } from 'express';
import authRoutes from './authRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import reportRoutes from './reportRoutes.js';
import userRoutes from './userRoutes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    data: {
      status: 'ok',
      service: 'SuaraKita API',
    },
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/reports', reportRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
