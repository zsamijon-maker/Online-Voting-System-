import { Router } from 'express';
import { getUsers, getUserById, updateUser, updateUserRoles, deleteUser, getMe } from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

router.get('/me',        authenticate,                     asyncHandler(getMe));
router.get('/',          authenticate, authorize('admin'), asyncHandler(getUsers));
router.get('/:id',       authenticate, authorize('admin'), asyncHandler(getUserById));
router.patch('/:id',     authenticate, authorize('admin'), asyncHandler(updateUser));
router.patch('/:id/roles', authenticate, authorize('admin'), asyncHandler(updateUserRoles));
router.delete('/:id',   authenticate, authorize('admin'), asyncHandler(deleteUser));

export default router;
