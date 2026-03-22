import { Router } from 'express';
import {
  getCandidates,
  getCandidateById,
  createCandidate,
  updateCandidate,
  deleteCandidate,
} from '../controllers/candidateController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { parseImageUpload } from '../middleware/uploadImage.js';

const router = Router({ mergeParams: true });

router.get('/',      authenticate,                                asyncHandler(getCandidates));
router.get('/:id',   authenticate,                                asyncHandler(getCandidateById));
router.post('/',     authenticate, authorize('election_committee'), parseImageUpload, asyncHandler(createCandidate));
router.patch('/:id', authenticate, authorize('election_committee'), parseImageUpload, asyncHandler(updateCandidate));
router.put('/:id',   authenticate, authorize('election_committee'), parseImageUpload, asyncHandler(updateCandidate));
router.delete('/:id', authenticate, authorize('election_committee'), asyncHandler(deleteCandidate));

export default router;
