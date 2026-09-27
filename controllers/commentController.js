import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import Notification from '../models/Notification.js';

// @desc    Get comments for a post
// @route   GET /api/comments/:postId
// @access  Public
export const getComments = async (req, res) => {
  try {
    const comments = await Comment.find({ postId: req.params.postId })
      .populate('userId', 'name email role verified avatar')
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create comment
// @route   POST /api/comments/:postId
// @access  Private
export const createComment = async (req, res) => {
  try {
    const { content } = req.body;
    const { postId } = req.params;

    // Check if post exists
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = await Comment.create({
      postId,
      userId: req.user._id,
      content
    });

    // Update post comments count
    post.commentsCount += 1;
    await post.save();

    // Create notification for post owner
    if (post.userId.toString() !== req.user._id.toString()) {
      await Notification.create({
        userId: post.userId,
        type: 'comment',
        message: `${req.user.name} commented on your post`,
        relatedPostId: postId,
        relatedUserId: req.user._id
      });

      // Emit socket notification
      const io = req.app.get('io');
      io.to(`user_${post.userId}`).emit('notification', {
        type: 'comment',
        message: `${req.user.name} commented on your post`
      });
    }

    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'name email role verified avatar');

    // Emit socket event for new comment
    const io = req.app.get('io');
    io.to(`post_${postId}`).emit('newComment', populatedComment);

    res.status(201).json(populatedComment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user owns the comment or is admin
    if (comment.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    // Update post comments count
    const post = await Post.findById(comment.postId);
    if (post) {
      post.commentsCount = Math.max(0, post.commentsCount - 1);
      await post.save();
    }

    await comment.deleteOne();

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update comment
// @route   PUT /api/comments/:id
// @access  Private
export const updateComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user owns the comment
    if (comment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this comment' });
    }

    comment.content = req.body.content || comment.content;
    await comment.save();

    const updatedComment = await Comment.findById(comment._id)
      .populate('userId', 'name email role verified avatar');

    res.json(updatedComment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

