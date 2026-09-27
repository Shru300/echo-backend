import User from '../models/User.js';
import Post from '../models/Post.js';
import cloudinary from '../config/cloudinary.js';

// @desc    Get user profile
// @route   GET /api/users/:id
// @access  Public
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's posts count
    const postsCount = await Post.countDocuments({ userId: user._id });

    res.json({
      ...user.toObject(),
      postsCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, bio, department } = req.body;

    user.name = name || user.name;
    user.bio = bio || user.bio;
    user.department = department || user.department;

    // Upload avatar if provided
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;
      
      const result = await cloudinary.uploader.upload(dataURI, {
        folder: 'echoboard/avatars',
        resource_type: 'auto'
      });
      
      user.avatar = result.secure_url;
    }

    await user.save();

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all users (admin only)
// @route   GET /api/users
// @access  Private/Admin
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user verification status (admin/faculty only)
// @route   PUT /api/users/:id/verify
// @access  Private/Admin/Faculty
export const verifyUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.verified = !user.verified;
    await user.save();

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user role (admin only)
// @route   PUT /api/users/:id/role
// @access  Private/Admin
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.role = role;
    await user.save();

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search user by email
// @route   GET /api/users/search?email=example@email.com
// @access  Private
export const searchUserByEmail = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: 'Please provide an email address' });
    }

    // Trim and normalize email (emails are stored in lowercase in database)
    const normalizedEmail = email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Find user by exact email match in database (emails are stored in lowercase)
    // This ensures we only find users whose emails exist in the database
    const user = await User.findOne({ 
      email: normalizedEmail
    }).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found with this email' });
    }

    // Don't return the current user
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot search for your own email' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create faculty user (admin only)
// @route   POST /api/users/faculty
// @access  Private/Admin
export const createFaculty = async (req, res) => {
  try {
    const { name, email, password, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email: email.toLowerCase() });

    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Create faculty user
    const faculty = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'faculty',
      department: department || '',
      verified: true // Auto-verify faculty created by admin
    });

    res.status(201).json({
      _id: faculty._id,
      name: faculty.name,
      email: faculty.email,
      role: faculty.role,
      department: faculty.department,
      verified: faculty.verified
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create admin user (admin only)
// @route   POST /api/users/admin
// @access  Private/Admin
export const createAdmin = async (req, res) => {
  try {
    const { name, email, password, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email: email.toLowerCase() });

    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Create admin user
    const admin = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'admin',
      department: department || '',
      verified: true // Auto-verify admin created by admin
    });

    res.status(201).json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      department: admin.department,
      verified: admin.verified
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Change user password
// @route   PUT /api/users/change-password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide current password and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    // Get user with password field
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

