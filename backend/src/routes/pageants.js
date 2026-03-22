import { Router } from 'express';
import {
  getPageants,
  getPageantById,
  createPageant,
  updatePageant,
  updatePageantStatus,
  deletePageant,
} from '../controllers/pageantController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

router.get('/',          authenticate,                               asyncHandler(getPageants));
router.get('/:id',       authenticate,                               asyncHandler(getPageantById));
router.post('/',         authenticate, authorize('pageant_committee'), asyncHandler(createPageant));
router.patch('/:id',     authenticate, authorize('pageant_committee'), asyncHandler(updatePageant));
router.patch('/:id/status', authenticate, authorize('pageant_committee'), asyncHandler(updatePageantStatus));
router.delete('/:id',   authenticate, authorize('pageant_committee'), asyncHandler(deletePageant));

export default router;
