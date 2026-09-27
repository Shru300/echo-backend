import mongoose from 'mongoose';

const followingSchema = new mongoose.Schema({
  follower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  following: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound index to ensure one user can only follow another user once
followingSchema.index({ follower: 1, following: 1 }, { unique: true });

// Prevent following yourself
followingSchema.pre('save', async function(next) {
  if (this.follower.toString() === this.following.toString()) {
    return next(new Error('Cannot follow yourself'));
  }
  next();
});

const Following = mongoose.model('Following', followingSchema);

export default Following;

