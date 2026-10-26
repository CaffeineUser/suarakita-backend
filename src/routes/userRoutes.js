import { Router } from 'express';
import { userController } from '../controllers/userController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { updateProfileSchema } from '../validators/userValidator.js';

const router = Router();

router.get('/me', authenticate, userController.getMe);
router.patch('/me', authenticate, validateBody(updateProfileSchema), userController.updateMe);
router.get('/', authenticate, authorize('admin'), userController.getAllUsers);

export default router;
