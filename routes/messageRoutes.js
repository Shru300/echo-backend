import express from 'express';
import {
  getConversations,
  getMessages,
  sendMessage,
  markConversationAsRead,
  deleteConversation
} from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Debug: Log route registration
console.log('✅ Message routes registered: /conversations, /conversation/:userId, POST /, PUT /conversation/:userId/read');

router.get('/conversations', getConversations);
router.get('/conversation/:userId', getMessages);
router.put('/conversation/:userId/read', markConversationAsRead);
router.post('/', sendMessage);
router.delete('/conversation/:userId', deleteConversation);

export default router;
