import { Router } from 'express';
import { createCandidate, updateCandidate } from '../controllers/candidateController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { parseImageUpload } from '../middleware/uploadImage.js';

const router = Router();

const attachElectionFromBody = (req, res, next) => {
  const electionId = req.body?.electionId;
  if (!electionId) {
    return res.status(400).json({ error: 'electionId is required.' });
  }

  req.params.electionId = electionId;
  next();
};

router.post('/', authenticate, authorize('election_committee'), parseImageUpload, attachElectionFromBody, asyncHandler(createCandidate));
router.put('/:id', authenticate, authorize('election_committee'), parseImageUpload, attachElectionFromBody, asyncHandler(updateCandidate));

export default router;
