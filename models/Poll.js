import mongoose from 'mongoose';

const pollSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    unique: true
  },
  options: [{
    text: {
      type: String,
      required: true
    },
    votes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }],
  endsAt: {
    type: Date,
    required: true
  },
  totalVotes: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Update total votes before saving
pollSchema.pre('save', function(next) {
  this.totalVotes = this.options.reduce((total, option) => total + option.votes.length, 0);
  next();
});

const Poll = mongoose.model('Poll', pollSchema);

export default Poll;

