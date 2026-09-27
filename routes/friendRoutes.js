import express from 'express';
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  withdrawFriendRequest,
  getFriendRequests,
  getFriends,
  checkFriendship,
  removeFriend
} from '../controllers/friendController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.post('/request', sendFriendRequest);
router.get('/requests', getFriendRequests);
router.put('/request/:requestId/accept', acceptFriendRequest);
router.put('/request/:requestId/decline', declineFriendRequest);
router.delete('/request/:requestId', withdrawFriendRequest);
router.get('/check/:userId', checkFriendship);
router.delete('/:userId', removeFriend);
router.get('/', getFriends);

export default router;

