import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Poll from '../models/Poll.js';
import Following from '../models/Following.js';
import User from '../models/User.js';
import cloudinary from '../config/cloudinary.js';

// @desc    Get all posts
// @route   GET /api/posts
// @access  Public
export const getPosts = async (req, res) => {
  try {
    const { type, sort = 'trustScore' } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let query = {};
    if (type) {
      query.type = type;
    }

    // If user is authenticated and is a student, filter posts by followed faculty/admin
    if (req.user) {
      const currentUser = await User.findById(req.user._id);
      
      // Students can only see posts from faculty/admin they follow
      if (currentUser && currentUser.role === 'student') {
        // Get all faculty/admin IDs that the student follows
        const followingList = await Following.find({ follower: req.user._id })
          .select('following');
        
        const followingIds = followingList.map(f => f.following);
        
        // If student follows no one, return empty array (they see no posts)
        if (followingIds.length === 0) {
          return res.json({
            posts: [],
            currentPage: page,
            totalPages: 0,
            totalPosts: 0
          });
        }
        
        // Only show posts from followed faculty/admin
        query.userId = { $in: followingIds };
      }
      // Faculty and Admin can see all posts
    }
    // If not authenticated, show all posts (public access)

    // Sort options
    let sortOption = {};
    switch (sort) {
      case 'trustScore':
        sortOption = { trustScore: -1, createdAt: -1 };
        break;
      case 'latest':
        sortOption = { createdAt: -1 };
        break;
      case 'popular':
        sortOption = { commentsCount: -1, trustScore: -1 };
        break;
      default:
        sortOption = { trustScore: -1 };
    }

    const posts = await Post.find(query)
      .populate('userId', 'name email role verified avatar')
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments(query);

    res.json({
      posts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalPosts: total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single post
// @route   GET /api/posts/:id
// @access  Public
export const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('userId', 'name email role verified avatar department');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Get poll data if post type is poll
    let pollData = null;
    if (post.type === 'poll') {
      pollData = await Poll.findOne({ postId: post._id });
    }

    res.json({ post, poll: pollData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create post
// @route   POST /api/posts
// @access  Private (Faculty/Admin only)
export const createPost = async (req, res) => {
  try {
    // Check if user is faculty or admin (double check)
    if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Only faculty and admin members can create posts. Students are not authorized to post.' 
      });
    }

    const { title, content, type, eventDate, eventLocation, pollOptions, pollEndsAt } = req.body;

    let imageUrl = '';

    // Upload image to Cloudinary if provided
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;
      
      const result = await cloudinary.uploader.upload(dataURI, {
        folder: 'echoboard/posts',
        resource_type: 'auto'
      });
      
      imageUrl = result.secure_url;
    }

    const post = await Post.create({
      userId: req.user._id,
      title,
      content,
      type: type || 'announcement',
      imageUrl,
      eventDate: eventDate || null,
      eventLocation: eventLocation || ''
    });

    // Create poll if type is poll
    if (type === 'poll' && pollOptions) {
      const options = JSON.parse(pollOptions).map(opt => ({
        text: opt,
        votes: []
      }));

      await Poll.create({
        postId: post._id,
        options,
        endsAt: pollEndsAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days default
      });
    }

    const populatedPost = await Post.findById(post._id)
      .populate('userId', 'name email role verified avatar');

    // Emit socket event for new post
    const io = req.app.get('io');
    
    if (io) {
      // Get all students who follow this faculty/admin
      const followingList = await Following.find({ following: req.user._id })
        .select('follower');
      
      const followerIds = followingList.map(f => f.follower.toString());
      
      // Emit to all followers (students who follow this faculty/admin)
      followerIds.forEach(followerId => {
        io.to(`user_${followerId}`).emit('newPost', populatedPost);
      });
      
      // Also emit globally - frontend will filter based on user role
      // This ensures faculty/admin see all posts, and students only see if they follow
      io.emit('newPost', populatedPost);
    }

    res.status(201).json(populatedPost);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update post
// @route   PUT /api/posts/:id
// @access  Private
export const updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user owns the post or is admin
    if (post.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this post' });
    }

    const { title, content, eventDate, eventLocation } = req.body;

    post.title = title || post.title;
    post.content = content || post.content;
    post.eventDate = eventDate || post.eventDate;
    post.eventLocation = eventLocation || post.eventLocation;

    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate('userId', 'name email role verified avatar');

    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private
export const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user owns the post or is admin
    if (post.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    // Delete associated comments
    await Comment.deleteMany({ postId: post._id });

    // Delete associated poll if exists
    await Poll.deleteOne({ postId: post._id });

    await post.deleteOne();

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Flag post
// @route   PUT /api/posts/:id/flag
// @access  Private
export const flagPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    post.flagCount += 1;

    // Auto-flag if flagCount exceeds threshold
    if (post.flagCount >= 5) {
      post.flagged = true;
    }

    await post.save();

    res.json({ message: 'Post flagged successfully', post });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user posts
// @route   GET /api/posts/user/:userId
// @access  Public
export const getUserPosts = async (req, res) => {
  try {
    const posts = await Post.find({ userId: req.params.userId })
      .populate('userId', 'name email role verified avatar')
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

