import { Router } from 'express';
import {
  getCriteria,
  createCriteria,
  updateCriteria,
  deleteCriteria,
} from '../controllers/criteriaController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router({ mergeParams: true });

router.get('/',      authenticate,                               asyncHandler(getCriteria));
router.post('/',     authenticate, authorize('pageant_committee'), asyncHandler(createCriteria));
router.patch('/:id', authenticate, authorize('pageant_committee'), asyncHandler(updateCriteria));
router.delete('/:id', authenticate, authorize('pageant_committee'), asyncHandler(deleteCriteria));

export default router;
