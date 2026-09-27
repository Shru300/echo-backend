import express from 'express';
import {
  getComments,
  createComment,
  deleteComment,
  updateComment
} from '../controllers/commentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/:postId', getComments);
router.post('/:postId', protect, createComment);
router.put('/:id', protect, updateComment);
router.delete('/:id', protect, deleteComment);

export default router;

