require('dotenv').config();

// ── Firebase Admin — initialisé EN PREMIER avant tout autre require ───
require('./src/config/firebase');

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const path       = require('path');

const errorHandler = require('./src/middleware/errorHandler');
const { generalLimiter } = require('./src/middleware/rateLimiter');

const swaggerUi   = require('swagger-ui-express');
const swaggerSpec = require('./src/config/swagger');

// ── Routes ────────────────────────────────────────────────────────────
const authCustomRoutes   = require('./src/routes/authCustom');
const paysRoutes         = require('./src/routes/pays');
const userRoutes         = require('./src/routes/users');
const conversationRoutes = require('./src/routes/conversations');
const messageRoutes      = require('./src/routes/messages');
const messageOpsRoutes   = require('./src/routes/messageOps');
const statusRoutes       = require('./src/routes/status');
const callRoutes         = require('./src/routes/calls');
const meetingRoutes      = require('./src/routes/meetings');
const notifyRoutes       = require('./src/routes/notify');
const uploadRoutes       = require('./src/routes/upload');
const contactRoutes      = require('./src/routes/contacts');

// ── Socket handlers ───────────────────────────────────────────────────
const socketAuth = require('./src/socket/handlers/auth');
const {
  joinConversation, messageSend, typingStart, typingStop,
  presenceOnline, presenceOffline, handleDisconnect,
} = require('./src/socket/handlers/chat');

const {
  callUser, answerCall, rejectCall, iceCandidate, endCall,
  createGroupCall, joinGroupCall, leaveGroupCall, endGroupCall,
  groupOffer, groupAnswer, groupIceCandidate,
} = require('./src/socket/handlers/calls');

const {
  meetingCreate, meetingJoinRoom, meetingJoinRequest,
  meetingJoinAccept, meetingJoinDecline,
  meetingStart, meetingEnd, meetingChat,
  meetingLeave, meetingOffer, meetingAnswer, meetingIceCandidate,
} = require('./src/socket/handlers/meetings');

const { startMeetingScheduler, stopMeetingScheduler } = require('./src/services/meetingScheduler');

// ── App ───────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const userSockets = new Map();

app.set('io', io);
app.set('userSockets', userSockets);

app.use(cors());
app.use(express.json());
app.use(generalLimiter);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Servir les fichiers uploadés statiquement
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes API ────────────────────────────────────────────────────────
app.use('/api/auth',          authCustomRoutes);
app.use('/api/pays',          paysRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/conversations', messageRoutes);
app.use('/api/messages',      messageOpsRoutes);
app.use('/api/status',        statusRoutes);
app.use('/api/calls',         callRoutes);
app.use('/api/meetings',      meetingRoutes);
app.use('/api/upload',        uploadRoutes);
app.use('/api/contacts',      contactRoutes);
app.use('/notify',            notifyRoutes);

app.get('/health', (_, res) => res.json({ status: 'Serveur ok', timestamp: new Date().toISOString() }));

app.use(errorHandler);

// ── Socket.IO ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('[Socket] Client connecté:', socket.id);

  socket.authenticated = false;

  socketAuth(io, socket, userSockets);
  presenceOnline(io, socket, userSockets);
  presenceOffline(io, socket, userSockets);
  joinConversation(io, socket, userSockets);
  messageSend(io, socket, userSockets);
  typingStart(io, socket, userSockets);
  typingStop(io, socket, userSockets);
  callUser(io, socket, userSockets);
  answerCall(io, socket, userSockets);
  rejectCall(io, socket, userSockets);
  iceCandidate(io, socket, userSockets);
  endCall(io, socket, userSockets);
  createGroupCall(io, socket, userSockets);
  joinGroupCall(io, socket, userSockets);
  leaveGroupCall(io, socket, userSockets);
  endGroupCall(io, socket, userSockets);
  groupOffer(io, socket, userSockets);
  groupAnswer(io, socket, userSockets);
  groupIceCandidate(io, socket, userSockets);
  meetingCreate(io, socket, userSockets);
  meetingJoinRoom(io, socket, userSockets);
  meetingJoinRequest(io, socket, userSockets);
  meetingJoinAccept(io, socket, userSockets);
  meetingJoinDecline(io, socket, userSockets);
  meetingStart(io, socket, userSockets);
  meetingEnd(io, socket, userSockets);
  meetingChat(io, socket, userSockets);
  meetingLeave(io, socket, userSockets);
  meetingOffer(io, socket, userSockets);
  meetingAnswer(io, socket, userSockets);
  meetingIceCandidate(io, socket, userSockets);

  socket.on('disconnect', async () => {
    console.log('[Socket] Client déconnecté:', socket.id);
    await handleDisconnect(io, socket, userSockets);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server en marche sur le port ${PORT}`);
  startMeetingScheduler();
});

process.on('SIGINT', () => {
  console.log('Arrêt du serveur...');
  stopMeetingScheduler();
  process.exit(0);
});

module.exports = { app, server, io };