import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { sendSignInEmail, sendWelcomeEmail } from '../utils/emailService.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);

// Test email endpoint (for debugging)
router.post('/test-email', async (req, res) => {
  try {
    const { email, type = 'signin' } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    console.log(`\n🧪 [TEST] Testing email sending to: ${email}, type: ${type}`);
    
    let result;
    if (type === 'welcome') {
      result = await sendWelcomeEmail(email, 'Test User');
    } else {
      result = await sendSignInEmail(email, 'Test User');
    }

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Test email sent successfully',
        messageId: result.messageId 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send test email',
        error: result.error || result.message 
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error sending test email',
      error: error.message 
    });
  }
});

export default router;

