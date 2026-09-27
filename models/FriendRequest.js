import mongoose from 'mongoose';

const friendRequestSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
    index: true
  }
}, {
  timestamps: true
});

// Compound index to ensure unique friend requests
friendRequestSchema.index({ requester: 1, recipient: 1 }, { unique: true });

const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);

export default FriendRequest;

