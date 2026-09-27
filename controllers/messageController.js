import Message from '../models/Message.js';
import User from '../models/User.js';
import Friendship from '../models/Friendship.js';

// Helper function to generate conversation ID
const getConversationId = (userId1, userId2) => {
  return [userId1.toString(), userId2.toString()].sort().join('_');
};

// @desc    Get all conversations for current user
// @route   GET /api/messages/conversations
// @access  Private
export const getConversations = async (req, res) => {
  try {
    console.log('📬 getConversations called');
    const userId = req.user._id;

    // Get all messages involving the current user
    const messages = await Message.find({
      $or: [
        { sender: userId },
        { recipient: userId }
      ]
    })
      .populate('sender', 'name avatar email')
      .populate('recipient', 'name avatar email')
      .sort({ createdAt: -1 });

    // Group by conversation ID
    const conversationMap = new Map();

    for (const message of messages) {
      const convId = message.conversationId;
      
      // Determine the other user
      const otherUserId = message.sender._id.toString() === userId.toString()
        ? message.recipient._id
        : message.sender._id;

      // Verify friendship before adding to conversations
      const areFriends = await Friendship.areFriends(userId, otherUserId);
      
      if (!areFriends) {
        // Skip messages from non-friends
        continue;
      }
      
      if (!conversationMap.has(convId)) {
        const otherUser = message.sender._id.toString() === userId.toString()
          ? message.recipient
          : message.sender;

        conversationMap.set(convId, {
          conversationId: convId,
          otherUser,
          lastMessage: {
            content: message.content,
            createdAt: message.createdAt,
            read: message.read
          },
          unreadCount: 0
        });
      }

      // Count unread messages
      if (
        message.recipient._id.toString() === userId.toString() &&
        !message.read
      ) {
        const conv = conversationMap.get(convId);
        conv.unreadCount++;
      }
    }

    const conversations = Array.from(conversationMap.values());

    res.json(conversations);
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get messages in a conversation
// @route   GET /api/messages/conversation/:userId
// @access  Private
export const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (!userId) {
      return res.status(400).json({ message: 'Please provide a user ID' });
    }

    // Check if the other user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if users are friends
    const areFriends = await Friendship.areFriends(currentUserId, userId);
    if (!areFriends) {
      return res.status(403).json({ 
        message: 'You can only message users who are your friends. Please send a friend request first.' 
      });
    }

    const conversationId = getConversationId(currentUserId, userId);

    // Mark all unread messages as read FIRST (before fetching)
    // This ensures messages are marked as read immediately when conversation is viewed
    await Message.updateMany(
      {
        conversationId,
        recipient: currentUserId,
        read: false
      },
      { read: true }
    );

    // Get all messages in this conversation
    const messages = await Message.find({ conversationId })
      .populate('sender', 'name avatar')
      .populate('recipient', 'name avatar')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark messages in a conversation as read
// @route   PUT /api/messages/conversation/:userId/read
// @access  Private
export const markConversationAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (!userId) {
      return res.status(400).json({ message: 'Please provide a user ID' });
    }

    const conversationId = getConversationId(currentUserId, userId);

    // Mark all unread messages as read
    const result = await Message.updateMany(
      {
        conversationId,
        recipient: currentUserId,
        read: false
      },
      { read: true }
    );

    res.json({ 
      message: 'Messages marked as read',
      updatedCount: result.modifiedCount 
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete/close a conversation
// @route   DELETE /api/messages/conversation/:userId
// @access  Private
export const deleteConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (!userId) {
      return res.status(400).json({ message: 'Please provide user ID' });
    }

    const conversationId = getConversationId(currentUserId, userId);

    // Delete all messages in this conversation
    await Message.deleteMany({ conversationId });

    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
export const sendMessage = async (req, res) => {
  try {
    const { recipientId, content } = req.body;

    if (!recipientId || !content) {
      return res.status(400).json({ message: 'Please provide recipient ID and message content' });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    // Don't allow sending message to self
    if (recipientId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot send message to yourself' });
    }

    // Check if users are friends
    const areFriends = await Friendship.areFriends(req.user._id, recipientId);
    if (!areFriends) {
      return res.status(403).json({ 
        message: 'You can only message users who are your friends. Please send a friend request first.' 
      });
    }

    const conversationId = getConversationId(req.user._id, recipientId);

    const message = await Message.create({
      sender: req.user._id,
      recipient: recipientId,
      content: content.trim(),
      conversationId
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name avatar email')
      .populate('recipient', 'name avatar email');

    // Emit socket event for real-time messaging
    const io = req.app.get('io');
    if (io) {
      console.log(`📤 Emitting message to recipient: user_${recipientId}`);
      console.log(`📤 Emitting message to sender: user_${req.user._id}`);
      
      // Get the room names
      const recipientRoom = `user_${recipientId}`;
      const senderRoom = `user_${req.user._id}`;
      
      // Convert message to plain object for Socket.io (populated might cause issues)
      const messageData = {
        _id: populatedMessage._id,
        sender: {
          _id: populatedMessage.sender._id,
          name: populatedMessage.sender.name,
          avatar: populatedMessage.sender.avatar,
          email: populatedMessage.sender.email
        },
        recipient: {
          _id: populatedMessage.recipient._id,
          name: populatedMessage.recipient.name,
          avatar: populatedMessage.recipient.avatar,
          email: populatedMessage.recipient.email
        },
        content: populatedMessage.content,
        read: populatedMessage.read,
        conversationId: populatedMessage.conversationId,
        createdAt: populatedMessage.createdAt,
        updatedAt: populatedMessage.updatedAt
      };
      
      // Emit to recipient
      io.to(recipientRoom).emit('newMessage', messageData);
      console.log(`✅ Emitted to room: ${recipientRoom}`);
      
      // Also emit to sender so they see their message immediately
      io.to(senderRoom).emit('newMessage', messageData);
      console.log(`✅ Emitted to room: ${senderRoom}`);
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: error.message });
  }
};

