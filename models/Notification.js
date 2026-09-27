import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['comment', 'upvote', 'mention', 'reply', 'announcement', 'follow'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedPostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  relatedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;

