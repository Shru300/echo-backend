import Following from '../models/Following.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

// @desc    Follow a user (student follows faculty/admin)
// @route   POST /api/following/:userId
// @access  Private
export const followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user._id;

    if (!userId) {
      return res.status(400).json({ message: 'Please provide user ID' });
    }

    if (userId === followerId.toString()) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    // Check if user to follow exists
    const userToFollow = await User.findById(userId);
    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already following
    const existingFollowing = await Following.findOne({
      follower: followerId,
      following: userId
    });

    if (existingFollowing) {
      return res.status(400).json({ message: 'Already following this user' });
    }

    // Create following relationship
    const following = await Following.create({
      follower: followerId,
      following: userId
    });

    const populatedFollowing = await Following.findById(following._id)
      .populate('follower', 'name avatar email role')
      .populate('following', 'name avatar email role');

    // Create notification for the user being followed
    await Notification.create({
      userId: userId,
      type: 'follow',
      message: `${req.user.name} started following you`,
      relatedUserId: followerId
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('newFollower', {
        follower: populatedFollowing.follower
      });
      io.to(`user_${userId}`).emit('notification', {
        type: 'follow',
        message: `${req.user.name} started following you`
      });
    }

    res.status(201).json(populatedFollowing);
  } catch (error) {
    console.error('Error following user:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Already following this user' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Unfollow a user
// @route   DELETE /api/following/:userId
// @access  Private
export const unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user._id;

    const following = await Following.findOneAndDelete({
      follower: followerId,
      following: userId
    });

    if (!following) {
      return res.status(404).json({ message: 'Not following this user' });
    }

    res.json({ message: 'Unfollowed successfully' });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Check if following a user
// @route   GET /api/following/check/:userId
// @access  Private
export const checkFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user._id;

    const following = await Following.findOne({
      follower: followerId,
      following: userId
    });

    res.json({ isFollowing: !!following });
  } catch (error) {
    console.error('Error checking following:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all users that the current user is following
// @route   GET /api/following
// @route   GET /api/following/:userId
// @access  Private
export const getFollowing = async (req, res) => {
  try {
    // If userId is provided in params, get that user's following list
    // Otherwise, get the current user's following list
    const userId = req.params.userId || req.user._id;

    const followingList = await Following.find({ follower: userId })
      .populate('following', 'name avatar email role verified')
      .sort({ createdAt: -1 });

    const following = followingList.map(f => f.following);

    res.json(following);
  } catch (error) {
    console.error('Error getting following:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all followers of a user
// @route   GET /api/following/followers/:userId
// @access  Private
export const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;

    const followersList = await Following.find({ following: userId })
      .populate('follower', 'name avatar email role verified')
      .sort({ createdAt: -1 });

    const followers = followersList.map(f => f.follower);

    res.json(followers);
  } catch (error) {
    console.error('Error getting followers:', error);
    res.status(500).json({ message: error.message });
  }
};

