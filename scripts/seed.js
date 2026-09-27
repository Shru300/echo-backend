import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Poll from '../models/Poll.js';
import Notification from '../models/Notification.js';

dotenv.config();

const users = [
  {
    name: 'Admin User',
    email: 'admin@echoboard.com',
    password: 'admin123',
    role: 'admin',
    verified: true,
    reputation: 100,
    department: 'Administration',
    bio: 'EchoBoard Administrator'
  },
  {
    name: 'Dr. Sarah Johnson',
    email: 'sarah.johnson@echoboard.com',
    password: 'faculty123',
    role: 'faculty',
    verified: true,
    reputation: 85,
    department: 'Computer Science',
    bio: 'Associate Professor of Computer Science'
  },
  {
    name: 'John Smith',
    email: 'john.smith@echoboard.com',
    password: 'student123',
    role: 'student',
    verified: true,
    reputation: 45,
    department: 'Computer Science',
    bio: 'CS Senior | Tech Enthusiast'
  },
  {
    name: 'Emily Chen',
    email: 'emily.chen@echoboard.com',
    password: 'student123',
    role: 'student',
    verified: false,
    reputation: 20,
    department: 'Engineering',
    bio: 'Engineering Student | Aspiring Developer'
  },
  {
    name: 'Michael Davis',
    email: 'michael.davis@echoboard.com',
    password: 'student123',
    role: 'student',
    verified: true,
    reputation: 60,
    department: 'Business',
    bio: 'Business Administration Major'
  }
];

const posts = [
  {
    title: '🎉 Welcome to EchoBoard!',
    content: 'Welcome to EchoBoard - your decentralized community bulletin system! This platform is designed to help our campus community stay connected through announcements, events, polls, and discussions. Feel free to explore and share your thoughts!',
    type: 'announcement'
  },
  {
    title: '📚 Study Group - Data Structures',
    content: 'Looking to form a study group for Data Structures & Algorithms. We\'ll meet twice a week to solve problems and review concepts. All skill levels welcome! Drop a comment if you\'re interested.',
    type: 'discussion'
  },
  {
    title: '🎓 Tech Conference 2025',
    content: 'Join us for the annual Tech Conference featuring industry leaders, workshops, and networking opportunities. Registration is now open!',
    type: 'event',
    eventDate: new Date('2025-12-15'),
    eventLocation: 'Main Auditorium'
  },
  {
    title: '💡 Campus WiFi Improvements',
    content: 'Great news! The campus WiFi infrastructure has been upgraded. You should experience faster speeds and better connectivity across all buildings. Let us know if you notice any improvements!',
    type: 'announcement'
  },
  {
    title: '🏀 Basketball Tournament Registration',
    content: 'Annual basketball tournament is coming up! Form your teams and register before November 15th. Prizes for top 3 teams. Let\'s see some school spirit!',
    type: 'event',
    eventDate: new Date('2025-11-20'),
    eventLocation: 'Sports Complex'
  },
  {
    title: '🍕 What\'s the best late-night food spot?',
    content: 'Final exams are approaching and we need to know - where\'s the best place for late-night food near campus? Cast your vote!',
    type: 'poll'
  },
  {
    title: '📖 Library Extended Hours During Finals',
    content: 'The library will be open 24/7 during finals week (Dec 10-17). Additional study rooms have been set up. Coffee and snacks will be available. Good luck with your exams!',
    type: 'announcement'
  },
  {
    title: '🤝 Hackathon 2025 - Team Formation',
    content: 'Our annual hackathon is coming up! Looking for passionate developers, designers, and innovators to form a team. Theme: Sustainable Technology. Comment with your skills!',
    type: 'discussion'
  }
];

const pollOptions = [
  ['Pizza Palace', 'Taco Truck', 'Burger Joint', '24/7 Diner']
];

const comments = [
  { text: 'This is awesome! Excited to be part of this community! 🚀', postIndex: 0 },
  { text: 'Count me in for the study group! I\'m working on leetcode problems daily.', postIndex: 1 },
  { text: 'Would love to join! I struggle with dynamic programming though.', postIndex: 1 },
  { text: 'Great initiative! Will there be any workshops on AI/ML?', postIndex: 2 },
  { text: 'Finally! The old WiFi was so slow. Thanks for the upgrade!', postIndex: 3 },
  { text: 'My team is ready! Where do we register?', postIndex: 4 },
  { text: 'This is exactly what we needed. Thank you! 📚', postIndex: 6 },
  { text: 'I\'m a full-stack developer, looking for a designer and a business person!', postIndex: 7 },
  { text: 'I can handle the design work! Let\'s connect.', postIndex: 7 }
];

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Post.deleteMany({});
    await Comment.deleteMany({});
    await Poll.deleteMany({});
    await Notification.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create users
    const createdUsers = await User.create(users);
    console.log(`👥 Created ${createdUsers.length} users`);

    // Create posts
    const createdPosts = [];
    for (let i = 0; i < posts.length; i++) {
      const postData = {
        ...posts[i],
        userId: createdUsers[i % createdUsers.length]._id
      };

      const post = await Post.create(postData);
      createdPosts.push(post);

      // Add some upvotes to posts
      if (i < 5) {
        post.upvotes = [
          createdUsers[0]._id,
          createdUsers[1]._id,
          createdUsers[2]._id
        ];
        await post.save();
      }
    }
    console.log(`📝 Created ${createdPosts.length} posts`);

    // Create poll for the poll post
    const pollPost = createdPosts.find(p => p.type === 'poll');
    if (pollPost) {
      await Poll.create({
        postId: pollPost._id,
        options: pollOptions[0].map(opt => ({ text: opt, votes: [] })),
        endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      console.log('🗳️  Created poll');
    }

    // Create comments
    for (const commentData of comments) {
      const comment = await Comment.create({
        postId: createdPosts[commentData.postIndex]._id,
        userId: createdUsers[(commentData.postIndex + 2) % createdUsers.length]._id,
        content: commentData.text
      });

      // Update post comment count
      const post = createdPosts[commentData.postIndex];
      post.commentsCount += 1;
      await post.save();
    }
    console.log(`💬 Created ${comments.length} comments`);

    // Create some notifications
    await Notification.create([
      {
        userId: createdUsers[0]._id,
        type: 'comment',
        message: `${createdUsers[2].name} commented on your post`,
        relatedPostId: createdPosts[0]._id,
        relatedUserId: createdUsers[2]._id,
        read: false
      },
      {
        userId: createdUsers[1]._id,
        type: 'upvote',
        message: `${createdUsers[3].name} upvoted your post`,
        relatedPostId: createdPosts[1]._id,
        relatedUserId: createdUsers[3]._id,
        read: false
      }
    ]);
    console.log('🔔 Created notifications');

    console.log('\n✨ Database seeded successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin:   admin@echoboard.com / admin123');
    console.log('Faculty: sarah.johnson@echoboard.com / faculty123');
    console.log('Student: john.smith@echoboard.com / student123');
    console.log('Student: emily.chen@echoboard.com / student123');
    console.log('Student: michael.davis@echoboard.com / student123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();

