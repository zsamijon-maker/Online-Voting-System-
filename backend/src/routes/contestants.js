import { Router } from 'express';
import {
  getContestants,
  getContestantById,
  createContestant,
  updateContestant,
  deleteContestant,
} from '../controllers/contestantController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { parseImageUpload } from '../middleware/uploadImage.js';

const router = Router({ mergeParams: true });

router.get('/',      authenticate,                               asyncHandler(getContestants));
router.get('/:id',   authenticate,                               asyncHandler(getContestantById));
router.post('/',     authenticate, authorize('pageant_committee'), parseImageUpload, asyncHandler(createContestant));
router.patch('/:id', authenticate, authorize('pageant_committee'), parseImageUpload, asyncHandler(updateContestant));
router.put('/:id',   authenticate, authorize('pageant_committee'), parseImageUpload, asyncHandler(updateContestant));
router.delete('/:id', authenticate, authorize('pageant_committee'), asyncHandler(deleteContestant));

export default router;
