import Poll from '../models/Poll.js';
import Post from '../models/Post.js';

// @desc    Get poll by post ID
// @route   GET /api/polls/:postId
// @access  Public
export const getPoll = async (req, res) => {
  try {
    const poll = await Poll.findOne({ postId: req.params.postId });

    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    res.json(poll);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Vote on poll
// @route   POST /api/polls/:postId/vote
// @access  Private
export const votePoll = async (req, res) => {
  try {
    const { optionIndex } = req.body;
    const poll = await Poll.findOne({ postId: req.params.postId });

    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    // Check if poll has ended
    if (new Date() > poll.endsAt) {
      return res.status(400).json({ message: 'Poll has ended' });
    }

    const userId = req.user._id;

    // Remove user's previous vote if exists
    poll.options.forEach(option => {
      option.votes = option.votes.filter(id => id.toString() !== userId.toString());
    });

    // Add new vote
    if (optionIndex >= 0 && optionIndex < poll.options.length) {
      poll.options[optionIndex].votes.push(userId);
    } else {
      return res.status(400).json({ message: 'Invalid option index' });
    }

    await poll.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(`post_${poll.postId}`).emit('pollUpdated', poll);

    res.json(poll);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get poll results
// @route   GET /api/polls/:postId/results
// @access  Public
export const getPollResults = async (req, res) => {
  try {
    const poll = await Poll.findOne({ postId: req.params.postId });

    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    const results = poll.options.map(option => ({
      text: option.text,
      voteCount: option.votes.length,
      percentage: poll.totalVotes > 0 
        ? ((option.votes.length / poll.totalVotes) * 100).toFixed(1)
        : 0
    }));

    res.json({
      results,
      totalVotes: poll.totalVotes,
      endsAt: poll.endsAt,
      hasEnded: new Date() > poll.endsAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

