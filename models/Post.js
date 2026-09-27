import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please provide a title'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Please provide content'],
    maxlength: [5000, 'Content cannot exceed 5000 characters']
  },
  type: {
    type: String,
    enum: ['announcement', 'event', 'poll', 'discussion'],
    default: 'announcement'
  },
  imageUrl: {
    type: String,
    default: ''
  },
  upvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  downvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  trustScore: {
    type: Number,
    default: 0
  },
  flagged: {
    type: Boolean,
    default: false
  },
  flagCount: {
    type: Number,
    default: 0
  },
  commentsCount: {
    type: Number,
    default: 0
  },
  eventDate: {
    type: Date
  },
  eventLocation: {
    type: String
  }
}, {
  timestamps: true
});

// Calculate trust score before saving
postSchema.pre('save', async function(next) {
  if (this.isModified('upvotes') || this.isModified('downvotes')) {
    // Get user details for upvoters to check verified status
    const User = mongoose.model('User');
    const upvoters = await User.find({ _id: { $in: this.upvotes } });
    
    let verifiedUpvotes = 0;
    upvoters.forEach(user => {
      if (user.verified) verifiedUpvotes++;
    });
    
    const regularUpvotes = this.upvotes.length - verifiedUpvotes;
    const totalDownvotes = this.downvotes.length;
    
    // Trust score formula: regular upvotes + (verified upvotes * 2) - downvotes
    this.trustScore = regularUpvotes + (verifiedUpvotes * 2) - totalDownvotes;
  }
  next();
});

const Post = mongoose.model('Post', postSchema);

export default Post;

