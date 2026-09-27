import express from 'express';
import {
  followUser,
  unfollowUser,
  checkFollowing,
  getFollowing,
  getFollowers
} from '../controllers/followingController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.post('/:userId', followUser);
router.delete('/:userId', unfollowUser);
router.get('/check/:userId', checkFollowing);
router.get('/followers/:userId', getFollowers);
router.get('/:userId', getFollowing); // Get specific user's following list
router.get('/', getFollowing); // Get current user's following list

export default router;

