import FriendRequest from '../models/FriendRequest.js';
import Friendship from '../models/Friendship.js';
import User from '../models/User.js';

// @desc    Send friend request
// @route   POST /api/friends/request
// @access  Private
export const sendFriendRequest = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const requesterId = req.user._id;

    if (!recipientId) {
      return res.status(400).json({ message: 'Please provide recipient ID' });
    }

    if (recipientId === requesterId.toString()) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already friends
    const areFriends = await Friendship.areFriends(requesterId, recipientId);
    if (areFriends) {
      return res.status(400).json({ message: 'Already friends with this user' });
    }

    // Check if friend request already exists
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId }
      ]
    });

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        if (existingRequest.requester.toString() === requesterId.toString()) {
          return res.status(400).json({ message: 'Friend request already sent' });
        } else {
          // Recipient is trying to send request back - auto accept
          existingRequest.status = 'accepted';
          await existingRequest.save();
          
          // Create friendship - ensure consistent ordering (smaller ID first)
          const user1Id = requesterId.toString() < recipientId.toString() ? requesterId : recipientId;
          const user2Id = requesterId.toString() < recipientId.toString() ? recipientId : requesterId;
          await Friendship.create({
            user1: user1Id,
            user2: user2Id
          });

          return res.json({ message: 'Friend request accepted automatically', status: 'accepted' });
        }
      } else if (existingRequest.status === 'accepted') {
        // Check if they're actually still friends (might have been removed)
        const areFriends = await Friendship.areFriends(requesterId, recipientId);
        if (areFriends) {
          return res.status(400).json({ message: 'Already friends with this user' });
        } else {
          // They're not friends anymore, delete old request and create new one
          await FriendRequest.findByIdAndDelete(existingRequest._id);
          // Continue to create new request below
        }
      } else if (existingRequest.status === 'rejected') {
        // Delete old rejected request and allow new one
        await FriendRequest.findByIdAndDelete(existingRequest._id);
        // Continue to create new request below
      }
    }

    // Create new friend request - check for duplicate first
    try {
      const friendRequest = await FriendRequest.create({
        requester: requesterId,
        recipient: recipientId,
        status: 'pending'
      });

      const populatedRequest = await FriendRequest.findById(friendRequest._id)
        .populate('requester', 'name avatar email')
        .populate('recipient', 'name avatar email');

      // Emit socket event to recipient for new friend request
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${recipientId}`).emit('friendRequestReceived', populatedRequest);
        // Also emit to requester to update their sent requests list
        io.to(`user_${requesterId}`).emit('friendRequestSent', populatedRequest);
      }

      return res.status(201).json(populatedRequest);
    } catch (createError) {
      // Handle duplicate key error
      if (createError.code === 11000) {
        // Friend request might already exist, check again
        const existingRequest = await FriendRequest.findOne({
          requester: requesterId,
          recipient: recipientId
        });
        
        if (existingRequest) {
          return res.status(400).json({ message: 'Friend request already sent' });
        }
      }
      throw createError; // Re-throw if not a duplicate error
    }
  } catch (error) {
    console.error('Error sending friend request:', error);
    // Handle duplicate key error (unique index violation)
    if (error.code === 11000 || error.name === 'MongoServerError') {
      return res.status(400).json({ message: 'Friend request already exists' });
    }
    res.status(500).json({ 
      message: error.message || 'Failed to send friend request',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Accept friend request
// @route   PUT /api/friends/request/:requestId/accept
// @access  Private
export const acceptFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    // Check if user is the recipient
    if (friendRequest.recipient.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to accept this request' });
    }

    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Friend request already processed' });
    }

    // Update request status
    friendRequest.status = 'accepted';
    await friendRequest.save();

    // Create friendship - ensure consistent ordering (smaller ID first)
    const user1Id = friendRequest.requester.toString() < friendRequest.recipient.toString() 
      ? friendRequest.requester 
      : friendRequest.recipient;
    const user2Id = friendRequest.requester.toString() < friendRequest.recipient.toString() 
      ? friendRequest.recipient 
      : friendRequest.requester;
    await Friendship.create({
      user1: user1Id,
      user2: user2Id
    });

    const populatedRequest = await FriendRequest.findById(friendRequest._id)
      .populate('requester', 'name avatar email')
      .populate('recipient', 'name avatar email');

    // Get user details for both users
    const requesterUser = await User.findById(friendRequest.requester).select('name avatar email');
    const recipientUser = await User.findById(friendRequest.recipient).select('name avatar email');

    // Emit socket events to both users
    const io = req.app.get('io');
    if (io) {
      // Notify requester that their request was accepted
      io.to(`user_${friendRequest.requester}`).emit('friendRequestAccepted', {
        request: populatedRequest,
        friend: recipientUser
      });
      
      // Notify recipient that they accepted the request
      io.to(`user_${friendRequest.recipient}`).emit('friendRequestAccepted', {
        request: populatedRequest,
        friend: requesterUser
      });
    }

    res.json(populatedRequest);
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Decline friend request
// @route   PUT /api/friends/request/:requestId/decline
// @access  Private
export const declineFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    // Check if user is the recipient
    if (friendRequest.recipient.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to decline this request' });
    }

    friendRequest.status = 'rejected';
    await friendRequest.save();

    const populatedRequest = await FriendRequest.findById(friendRequest._id)
      .populate('requester', 'name avatar email')
      .populate('recipient', 'name avatar email');

    // Emit socket events to both users
    const io = req.app.get('io');
    if (io) {
      // Notify requester that their request was declined
      io.to(`user_${friendRequest.requester}`).emit('friendRequestDeclined', populatedRequest);
      
      // Notify recipient that they declined the request
      io.to(`user_${friendRequest.recipient}`).emit('friendRequestDeclined', populatedRequest);
    }

    res.json({ message: 'Friend request declined' });
  } catch (error) {
    console.error('Error declining friend request:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Withdraw/Cancel friend request
// @route   DELETE /api/friends/request/:requestId
// @access  Private
export const withdrawFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    // Check if user is the requester
    if (friendRequest.requester.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to withdraw this request' });
    }

    // Only allow withdrawing pending requests
    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Can only withdraw pending friend requests' });
    }

    const recipientId = friendRequest.recipient;
    const requesterId = friendRequest.requester;

    const populatedRequest = await FriendRequest.findById(requestId)
      .populate('requester', 'name avatar email')
      .populate('recipient', 'name avatar email');

    await friendRequest.deleteOne();

    // Emit socket events to both users
    const io = req.app.get('io');
    if (io) {
      // Notify recipient that the request was withdrawn
      io.to(`user_${recipientId}`).emit('friendRequestWithdrawn', populatedRequest);
      
      // Notify requester that they withdrew the request
      io.to(`user_${requesterId}`).emit('friendRequestWithdrawn', populatedRequest);
    }

    res.json({ message: 'Friend request withdrawn' });
  } catch (error) {
    console.error('Error withdrawing friend request:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get friend requests (sent and received)
// @route   GET /api/friends/requests
// @access  Private
export const getFriendRequests = async (req, res) => {
  try {
    const userId = req.user._id;

    const requests = await FriendRequest.find({
      $or: [
        { requester: userId },
        { recipient: userId }
      ],
      status: 'pending'
    })
      .populate('requester', 'name avatar email')
      .populate('recipient', 'name avatar email')
      .sort({ createdAt: -1 });

    // Separate sent and received requests
    const sent = requests.filter(r => r.requester._id.toString() === userId.toString());
    const received = requests.filter(r => r.recipient._id.toString() === userId.toString());

    res.json({ sent, received });
  } catch (error) {
    console.error('Error getting friend requests:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get friends list
// @route   GET /api/friends
// @access  Private
export const getFriends = async (req, res) => {
  try {
    const userId = req.user._id;

    const friendships = await Friendship.find({
      $or: [
        { user1: userId },
        { user2: userId }
      ]
    })
      .populate('user1', 'name avatar email')
      .populate('user2', 'name avatar email')
      .sort({ createdAt: -1 });

    // Get the other user (not the current user) from each friendship
    const friends = friendships.map(friendship => {
      return friendship.user1._id.toString() === userId.toString()
        ? friendship.user2
        : friendship.user1;
    });

    res.json(friends);
  } catch (error) {
    console.error('Error getting friends:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Check if two users are friends
// @route   GET /api/friends/check/:userId
// @access  Private
export const checkFriendship = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const areFriends = await Friendship.areFriends(currentUserId, userId);

    res.json({ areFriends });
  } catch (error) {
    console.error('Error checking friendship:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove/unfriend a friend
// @route   DELETE /api/friends/:userId
// @access  Private
export const removeFriend = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (!userId) {
      return res.status(400).json({ message: 'Please provide user ID' });
    }

    if (userId === currentUserId.toString()) {
      return res.status(400).json({ message: 'Cannot unfriend yourself' });
    }

    // Find and delete the friendship
    const friendship = await Friendship.findOne({
      $or: [
        { user1: currentUserId, user2: userId },
        { user1: userId, user2: currentUserId }
      ]
    });

    if (!friendship) {
      return res.status(404).json({ message: 'Friendship not found' });
    }

    // Delete the friendship
    await Friendship.findByIdAndDelete(friendship._id);

    // Delete all old friend requests between these users (accepted or rejected)
    // This allows them to send new friend requests if they want to re-add each other
    await FriendRequest.deleteMany({
      $or: [
        { requester: currentUserId, recipient: userId },
        { requester: userId, recipient: currentUserId }
      ]
    });

    // Emit socket event to notify the other user
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('friendRemoved', { userId: currentUserId });
      io.to(`user_${currentUserId}`).emit('friendRemoved', { userId });
    }

    res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({ message: error.message });
  }
};

