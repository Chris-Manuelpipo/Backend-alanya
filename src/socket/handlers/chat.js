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
      // ✅ Vérifier authentification socket
      if (!socket.authenticated) {
        return socket.emit('error', { 
          message: 'Unauthenticated',
          code: 'UNAUTHENTICATED',
        });
      }

      const { conversationID, content, type = 0, mediaUrl, mediaName, mediaDuration, replyToID, replyToContent, isStatusReply = 0 } = data;
      const senderID = socket.alanyaID; // ✅ Utiliser l'ID du socket authentifié

      if (!conversationID || (!content && !mediaUrl)) {
        return socket.emit('error', { 
          message: 'conversationID and (content or mediaUrl) required' 
        });
      }

      // ✅ ÉTAPE 1 : PERSISTER le message en DB
      const [result] = await pool.execute(
        `INSERT INTO message
           (senderID, conversationID, content, type, status, sendAt,
            mediaUrl, mediaName, mediaDuration, replyToID, replyToContent, isStatusReply)
         VALUES (?, ?, ?, ?, 1, NOW(), ?, ?, ?, ?, ?, ?)`,
        [
          senderID, conversationID, content ?? null, type,
          mediaUrl ?? null, mediaName ?? null, mediaDuration ?? null,
          replyToID ?? null, replyToContent ?? null, isStatusReply,
        ]
      );

      const msgID = result.insertId;

      // ✅ ÉTAPE 2 : Mettre à jour résumé conversation
      await pool.execute(
        `UPDATE conversation
         SET lastMessage = ?, lastMessageAt = NOW(),
             lastMessageSenderID = ?, lastMessageType = ?
         WHERE conversID = ?`,
        [
          content ? content.substring(0, 200) : (mediaName ?? 'Média'),
          senderID, type, conversationID,
        ]
      );

      // ✅ ÉTAPE 3 : Incrémenter compteur non-lus pour autres participants
      await pool.execute(
        'UPDATE conv_participants SET unreadCount = unreadCount + 1 WHERE conversID = ? AND alanyaID != ?',
        [conversationID, senderID]
      );

      // ✅ ÉTAPE 4 : Récupérer message complet avec infos sender
      const [rows] = await pool.execute(
        `SELECT m.*, u.nom AS sender_nom, u.pseudo AS sender_pseudo, u.avatar_url AS sender_avatar
         FROM message m
         JOIN users u ON m.senderID = u.alanyaID
         WHERE m.msgID = ?`,
        [msgID]
      );

      const msg = rows[0];

      // ✅ ÉTAPE 5 : BROADCAST le message via Socket.IO (maintenant persistent!)
      io.to(`conversation_${conversationID}`).emit('message:received', msg);

      // Aussi envoyer directement aux sockets des participants
      const [participants] = await pool.execute(
        'SELECT alanyaID FROM conv_participants WHERE conversID = ? AND alanyaID != ?',
        [conversationID, senderID]
      );

      for (const p of participants) {
        const sid = userSockets.get(p.alanyaID);
        if (sid) io.to(sid).emit('message:received', msg);
      }

      // ✅ ÉTAPE 6 : Notif FCM aux autres participants
      const [sender] = await pool.execute(
        'SELECT nom FROM users WHERE alanyaID = ?', [senderID]
      );
      const senderName = sender[0]?.nom ?? 'Talky';
      
      // Import async pour éviter circular dependency
      setTimeout(() => {
        const { notifyNewMessage } = require('../../services/notificationService');
        notifyNewMessage(conversationID, senderID, senderName, content, type).catch(e => 
          console.warn('[FCM notification]', e.message)
        );
      }, 0);

      socket.emit('message:sent', { msgID, ...msg });
    } catch (error) {
      console.error('[Socket message:send]', error.message);
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
