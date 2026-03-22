import { Router } from 'express';
import { getJudges, getAvailableJudges, assignJudge, assignJudgesBulk, removeJudge } from '../controllers/judgeController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router({ mergeParams: true });

router.get('/',           authenticate,                               asyncHandler(getJudges));
router.get('/available',  authenticate, authorize('pageant_committee'), asyncHandler(getAvailableJudges));
router.post('/',          authenticate, authorize('pageant_committee'), asyncHandler(assignJudge));
router.post('/bulk',      authenticate, authorize('pageant_committee'), asyncHandler(assignJudgesBulk));
router.delete('/:judgeId', authenticate, authorize('pageant_committee'), asyncHandler(removeJudge));

export default router;
