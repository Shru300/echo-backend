import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

// @desc    Vote on post
// @route   POST /api/votes/post/:id
// @access  Private
export const votePost = async (req, res) => {
  try {
    const { voteType } = req.body; // 'upvote' or 'downvote'
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.user._id;

    // Remove existing votes
    post.upvotes = post.upvotes.filter(id => id.toString() !== userId.toString());
    post.downvotes = post.downvotes.filter(id => id.toString() !== userId.toString());

    // Add new vote
    if (voteType === 'upvote') {
      post.upvotes.push(userId);

      // Update post owner reputation
      if (post.userId.toString() !== userId.toString()) {
        await User.findByIdAndUpdate(post.userId, { $inc: { reputation: 1 } });

        // Create notification
        await Notification.create({
          userId: post.userId,
          type: 'upvote',
          message: `${req.user.name} upvoted your post`,
          relatedPostId: post._id,
          relatedUserId: userId
        });
      }
    } else if (voteType === 'downvote') {
      post.downvotes.push(userId);

      // Update post owner reputation
      if (post.userId.toString() !== userId.toString()) {
        await User.findByIdAndUpdate(post.userId, { $inc: { reputation: -1 } });
      }
    }

    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate('userId', 'name email role verified avatar');

    // Emit socket event
    const io = req.app.get('io');
    io.emit('postUpdated', updatedPost);

    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Vote on comment
// @route   POST /api/votes/comment/:id
// @access  Private
export const voteComment = async (req, res) => {
  try {
    const { voteType } = req.body; // 'upvote' or 'downvote'
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const userId = req.user._id;

    // Remove existing votes
    comment.upvotes = comment.upvotes.filter(id => id.toString() !== userId.toString());
    comment.downvotes = comment.downvotes.filter(id => id.toString() !== userId.toString());

    // Add new vote
    if (voteType === 'upvote') {
      comment.upvotes.push(userId);
    } else if (voteType === 'downvote') {
      comment.downvotes.push(userId);
    }

    await comment.save();

    const updatedComment = await Comment.findById(comment._id)
      .populate('userId', 'name email role verified avatar');

    res.json(updatedComment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

