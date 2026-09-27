import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

import connectDB from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import postRoutes from './routes/postRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import voteRoutes from './routes/voteRoutes.js';
import pollRoutes from './routes/pollRoutes.js';
import userRoutes from './routes/userRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import followingRoutes from './routes/followingRoutes.js';

import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

/* =========================
   ✅ CORS CONFIG (FIXED)
========================= */

const allowedOrigins = [
  'http://localhost:5173',
  'https://echo-frontend-eta.vercel.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow server-to-server & mobile requests
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

/* =========================
   ✅ Express Middleware
========================= */

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   ✅ Socket.IO Setup
========================= */

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Make io accessible in routes
app.set('io', io);

/* =========================
   ✅ Database Connection
========================= */

connectDB();

/* =========================
   ✅ API Routes
========================= */

app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/following', followingRoutes);

/* =========================
   ✅ Health Check
========================= */

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'EchoBoard API is running 🚀'
  });
});

/* =========================
   ✅ Error Handler
========================= */

app.use(errorHandler);

/* =========================
   ✅ Socket.IO Events
========================= */

io.on('connection', (socket) => {
  console.log('🟢 User connected:', socket.id);

  socket.on('joinPost', (postId) => {
    socket.join(`post_${postId}`);
  });

  socket.on('leavePost', (postId) => {
    socket.leave(`post_${postId}`);
  });

  socket.on('joinUser', (userId) => {
    socket.join(`user_${userId}`);
  });

  // 📞 WebRTC Call Signaling
  socket.on('call:initiate', ({ to, from, callType, callerName, callerAvatar }) => {
    socket.to(`user_${to}`).emit('call:incoming', {
      from,
      callType,
      callerName,
      callerAvatar,
      callId: `${from}_${to}_${Date.now()}`
    });
  });

  socket.on('call:accept', ({ to, from, callId }) => {
    socket.to(`user_${to}`).emit('call:accepted', { from, callId });
  });

  socket.on('call:reject', ({ to, from, callId }) => {
    socket.to(`user_${to}`).emit('call:rejected', { from, callId });
  });

  socket.on('call:end', ({ to, from, callId }) => {
    socket.to(`user_${to}`).emit('call:ended', { from, callId });
  });

  socket.on('call:offer', ({ to, offer, callId }) => {
    socket.to(`user_${to}`).emit('call:offer', { offer, callId });
  });

  socket.on('call:answer', ({ to, answer, callId }) => {
    socket.to(`user_${to}`).emit('call:answer', { answer, callId });
  });

  socket.on('call:ice-candidate', ({ to, candidate, callId }) => {
    socket.to(`user_${to}`).emit('call:ice-candidate', { candidate, callId });
  });

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected:', socket.id);
  });
});

/* =========================
   ✅ Server Start
========================= */

const PORT = process.env.PORT || 5001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export { io };
