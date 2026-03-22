import { Router } from 'express';
import { submitScores, getPageantResults, getMyScores } from '../controllers/scoreController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

router.post('/',                                  authenticate, authorize('judge'), asyncHandler(submitScores));
router.get('/pageants/:pageantId/results',         authenticate,                    asyncHandler(getPageantResults));
router.get('/pageants/:pageantId/my-scores',       authenticate, authorize('judge'), asyncHandler(getMyScores));

export default router;
