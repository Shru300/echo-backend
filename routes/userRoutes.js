import express from 'express';
import {
  getUserProfile,
  updateProfile,
  getAllUsers,
  verifyUser,
  updateUserRole,
  searchUserByEmail,
  createFaculty,
  createAdmin,
  changePassword
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.get('/', protect, authorize('admin'), getAllUsers);
router.get('/search', protect, searchUserByEmail);
router.post('/faculty', protect, authorize('admin'), createFaculty);
router.post('/admin', protect, authorize('admin'), createAdmin);
router.put('/change-password', protect, changePassword);
router.get('/:id', getUserProfile);
router.put('/profile', protect, upload.single('avatar'), updateProfile);
router.put('/:id/verify', protect, authorize('admin', 'faculty'), verifyUser);
router.put('/:id/role', protect, authorize('admin'), updateUserRole);

export default router;

