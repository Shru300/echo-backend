import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendSignInEmail, sendWelcomeEmail } from '../utils/emailService.js';

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { name, email, password, department } = req.body;
    // Explicitly ignore 'role' from request body - only students can register
    // Faculty and admin must be created by admin through admin panel

    // Check if user exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user - only students can register through this endpoint
    // Faculty and admin must be created by admin through admin panel
    const user = await User.create({
      name,
      email,
      password,
      role: 'student', // Force role to student - ignore any role from request
      department
    });

    // Generate token
    const token = generateToken(user._id);

    // Send welcome email (non-blocking)
    console.log(`\n🔵 [AUTH CONTROLLER] Registration successful for: ${user.email}`);
    console.log(`   Calling sendWelcomeEmail for: ${user.email}, name: ${user.name}`);
    sendWelcomeEmail(user.email, user.name)
      .then(result => {
        if (!result.success) {
          console.error(`\n⚠️⚠️⚠️ Welcome email failed for ${user.email} ⚠️⚠️⚠️`);
          console.error(`   Reason: ${result.message || result.error}`);
        } else {
          console.log(`\n✅✅✅ Welcome email SUCCESS for ${user.email} ✅✅✅`);
        }
      })
      .catch(err => {
        console.error(`\n❌❌❌ Exception in sendWelcomeEmail promise for ${user.email} ❌❌❌`);
        console.error(`   Error:`, err);
      });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      verified: user.verified,
      reputation: user.reputation,
      token
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id);

    // Send sign-in notification email (non-blocking)
    console.log(`\n🔵 [AUTH CONTROLLER] Login successful for: ${user.email}`);
    console.log(`   Calling sendSignInEmail for: ${user.email}, name: ${user.name}`);
    sendSignInEmail(user.email, user.name)
      .then(result => {
        if (!result.success) {
          console.error(`\n⚠️⚠️⚠️ Sign-in email failed for ${user.email} ⚠️⚠️⚠️`);
          console.error(`   Reason: ${result.message || result.error}`);
        } else {
          console.log(`\n✅✅✅ Sign-in email SUCCESS for ${user.email} ✅✅✅`);
        }
      })
      .catch(err => {
        console.error(`\n❌❌❌ Exception in sendSignInEmail promise for ${user.email} ❌❌❌`);
        console.error(`   Error:`, err);
      });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      verified: user.verified,
      reputation: user.reputation,
      avatar: user.avatar,
      token
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

