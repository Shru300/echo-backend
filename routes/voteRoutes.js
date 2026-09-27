import express from 'express';
import { votePost, voteComment } from '../controllers/voteController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/post/:id', protect, votePost);
router.post('/comment/:id', protect, voteComment);

export default router;

