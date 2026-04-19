const pool = require('../../config/db');

const joinConversation = (io, socket, userSockets) => {
  socket.on('join_conversation', async (data) => {
    try {
      const { conversationID } = data;
      socket.join(`conversation_${conversationID}`);
      socket.emit('joined_conversation', { conversationID });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
};

const messageSend = (io, socket, userSockets) => {
  socket.on('message:send', async (data) => {
    try {
      const { conversationID, content, type, mediaUrl, senderID, senderName } = data;
      io.to(`conversation_${conversationID}`).emit('message:received', {
        conversationID,
        content,
        type,
        mediaUrl,
        senderID,
        senderName,
        sendAt: new Date(),
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
};

const typingStart = (io, socket, userSockets) => {
  socket.on('typing:start', (data) => {
    const { conversationID, userID } = data;
    socket.to(`conversation_${conversationID}`).emit('typing:started', { userID });
  });
};

const typingStop = (io, socket, userSockets) => {
  socket.on('typing:stop', (data) => {
    const { conversationID, userID } = data;
    socket.to(`conversation_${conversationID}`).emit('typing:stopped', { userID });
  });
};

// ── Présence ───────────────────────────────────────────────────────
// Persiste is_online / last_seen en DB ET broadcast l'event à tous
// les clients connectés.
const presenceOnline = (io, socket, userSockets) => {
  socket.on('presence:online', async (data) => {
    const userID = typeof data === 'object' ? data.userID : data;
    if (!userID) return;

    userSockets.set(Number(userID), socket.id);
    socket.alanyaID = Number(userID); // utilisé par le handler disconnect

    try {
      await pool.execute(
        'UPDATE users SET is_online = 1, last_seen = NOW() WHERE alanyaID = ?',
        [userID]
      );
    } catch (e) {
      console.warn('[Socket presence:online] DB update failed:', e.message);
    }

    io.emit('presence:updated', {
      userID: Number(userID),
      online: true,
      lastSeen: new Date().toISOString(),
    });
  });
};

const presenceOffline = (io, socket, userSockets) => {
  socket.on('presence:offline', async (data) => {
    const userID = typeof data === 'object' ? data.userID : data;
    if (!userID) return;

    userSockets.delete(Number(userID));

    try {
      await pool.execute(
        'UPDATE users SET is_online = 0, last_seen = NOW() WHERE alanyaID = ?',
        [userID]
      );
    } catch (e) {
      console.warn('[Socket presence:offline] DB update failed:', e.message);
    }

    io.emit('presence:updated', {
      userID: Number(userID),
      online: false,
      lastSeen: new Date().toISOString(),
    });
  });
};

// Appelé depuis server.js à la déconnexion brutale (fermeture app, perte
// réseau, etc.). Met la DB à jour et prévient les autres clients.
const handleDisconnect = async (io, socket, userSockets) => {
  const userID = socket.alanyaID;
  if (!userID) return;

  userSockets.delete(userID);

  try {
    await pool.execute(
      'UPDATE users SET is_online = 0, last_seen = NOW() WHERE alanyaID = ?',
      [userID]
    );
  } catch (e) {
    console.warn('[Socket disconnect] DB update failed:', e.message);
  }

  io.emit('presence:updated', {
    userID: Number(userID),
    online: false,
    lastSeen: new Date().toISOString(),
  });
};

module.exports = {
  joinConversation,
  messageSend,
  typingStart,
  typingStop,
  presenceOnline,
  presenceOffline,
  handleDisconnect,
};
