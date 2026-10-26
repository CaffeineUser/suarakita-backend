import { Router } from 'express';
import { categoryController } from '../controllers/categoryController.js';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createCategorySchema, updateCategorySchema } from '../validators/categoryValidator.js';

const router = Router();

router.get('/', optionalAuthenticate, categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validateBody(createCategorySchema),
  categoryController.createCategory,
);
router.patch(
  '/:id',
  authenticate,
  authorize('admin'),
  validateBody(updateCategorySchema),
  categoryController.updateCategory,
);
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  categoryController.deleteCategory,
);

export default router;
