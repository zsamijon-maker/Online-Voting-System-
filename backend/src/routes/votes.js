import { Router } from 'express';
import { submitVote, getElectionResults, getMyVotes } from '../controllers/voteController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

// Submit a vote
router.post('/', authenticate, authorize('voter'), asyncHandler(submitVote));

// Get results for an election
router.get('/elections/:electionId/results', authenticate, asyncHandler(getElectionResults));

// Get current user's votes for an election
router.get('/elections/:electionId/my-votes', authenticate, asyncHandler(getMyVotes));

export default router;
