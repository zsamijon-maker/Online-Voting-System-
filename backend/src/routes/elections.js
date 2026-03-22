import { Router } from 'express';
import {
  getElections,
  getElectionById,
  getElectionPositions,
  createElection,
  updateElection,
  updateElectionStatus,
  deleteElection,
} from '../controllers/electionController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

router.get('/',          authenticate,                                asyncHandler(getElections));
router.get('/:id/positions', authenticate,                             asyncHandler(getElectionPositions));
router.get('/:id',       authenticate,                                asyncHandler(getElectionById));
router.post('/',         authenticate, authorize('election_committee'), asyncHandler(createElection));
router.patch('/:id',     authenticate, authorize('election_committee'), asyncHandler(updateElection));
router.patch('/:id/status', authenticate, authorize('election_committee'), asyncHandler(updateElectionStatus));
router.delete('/:id',   authenticate, authorize('election_committee'), asyncHandler(deleteElection));

export default router;
