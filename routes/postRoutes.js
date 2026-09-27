import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  flagPost,
  getUserPosts
} from '../controllers/postController.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Optional auth middleware - attach user if token is present but don't require it
const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      // If token is invalid, continue without user (public access)
    }
  }
  next();
};

router.get('/', optionalAuth, getPosts);
router.get('/:id', getPost);
router.post('/', protect, authorize('faculty', 'admin'), upload.single('image'), createPost);
router.put('/:id', protect, updatePost);
router.delete('/:id', protect, deletePost);
router.put('/:id/flag', protect, flagPost);
router.get('/user/:userId', getUserPosts);

export default router;

