import { Router } from 'express';
import { submitVote, submitVotesBatch, getElectionResults, getMyVotes } from '../controllers/voteController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

// Submit a vote
router.post('/', authenticate, authorize('voter'), asyncHandler(submitVote));

// Submit multiple votes in one atomic action
router.post('/batch', authenticate, authorize('voter'), asyncHandler(submitVotesBatch));

// Get results for an election
router.get('/elections/:electionId/results', authenticate, asyncHandler(getElectionResults));

// Get current user's votes for an election
router.get('/elections/:electionId/my-votes', authenticate, asyncHandler(getMyVotes));

export default router;
