import express from 'express';
import { getPoll, votePoll, getPollResults } from '../controllers/pollController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/:postId', getPoll);
router.post('/:postId/vote', protect, votePoll);
router.get('/:postId/results', getPollResults);

export default router;

