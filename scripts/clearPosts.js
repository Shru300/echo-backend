import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Poll from '../models/Poll.js';

dotenv.config();

const clearPosts = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Delete all posts and related data
    const posts = await Post.find({});
    const postIds = posts.map(p => p._id);
    
    // Delete comments associated with posts
    await Comment.deleteMany({ postId: { $in: postIds } });
    console.log(`🗑️  Deleted comments for ${postIds.length} posts`);

    // Delete polls associated with posts
    await Poll.deleteMany({ postId: { $in: postIds } });
    console.log(`🗑️  Deleted polls for ${postIds.length} posts`);

    // Delete all posts
    const result = await Post.deleteMany({});
    console.log(`🗑️  Deleted ${result.deletedCount} posts`);

    console.log('\n✨ All posts cleared successfully!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing posts:', error);
    process.exit(1);
  }
};

clearPosts();

