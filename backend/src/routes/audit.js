import { Router } from 'express';
import { getAuditLogs, addAuditLog } from '../controllers/auditController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

router.get('/',  authenticate, authorize('admin'), asyncHandler(getAuditLogs));
router.post('/', authenticate, authorize('admin'), asyncHandler(addAuditLog));

export default router;
