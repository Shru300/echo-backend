import mongoose from 'mongoose';

const friendshipSchema = new mongoose.Schema({
  user1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  user2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure unique friendships and efficient queries
// Only create unique index on one combination to avoid conflicts
friendshipSchema.index({ user1: 1, user2: 1 }, { unique: true });

// Helper method to check if two users are friends
friendshipSchema.statics.areFriends = async function(userId1, userId2) {
  const friendship = await this.findOne({
    $or: [
      { user1: userId1, user2: userId2 },
      { user1: userId2, user2: userId1 }
    ]
  });
  return !!friendship;
};

const Friendship = mongoose.model('Friendship', friendshipSchema);

export default Friendship;

