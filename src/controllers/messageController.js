// src/controllers/messageController.js
const pool = require('../config/db');
const { notifyNewMessage } = require('../services/notificationService');

const getMessages = async (req, res) => {
  try {
    const { id } = req.params; // conversationID
    const alanyaID = req.user.alanyaID;
    const { limit = 50, before } = req.query;

    // ✅ Filtre corrigé :
    //   - isDeleted = 1 → supprimé pour tous → caché
    //   - deletedForID = alanyaID → supprimé pour moi uniquement → caché
    //   - sinon → visible
    let query = `
      SELECT m.*,
             u.nom        AS sender_nom,
             u.pseudo     AS sender_pseudo,
             u.avatar_url AS sender_avatar
      FROM message m
      JOIN users u ON m.senderID = u.alanyaID
      WHERE m.conversationID = ?
        AND m.isDeleted = 0
        AND (m.deletedForID IS NULL OR m.deletedForID != ?)
    `;
    const params = [id, alanyaID];

    if (before) {
      query += ' AND m.msgID < ?';
      params.push(parseInt(before));
    }

    query += ' ORDER BY m.sendAt DESC LIMIT ?';
    params.push(parseInt(limit) || 50);
 
    const [rows] = await pool.query(query, params);
    // Marquer comme lus les messages non lus de l'interlocuteur
    await pool.execute(
      `UPDATE message SET status = 3, readAt = NOW()
       WHERE conversationID = ? AND senderID != ? AND status < 3`,
      [id, alanyaID]
    );

    // Remettre unreadCount à 0 pour cet utilisateur
    await pool.execute(
      'UPDATE conv_participants SET unreadCount = 0 WHERE conversID = ? AND alanyaID = ?',
      [id, alanyaID]
    );

    res.json(rows.reverse());
  } catch (error) {
    throw error;
  }
};

const sendMessage = async (req, res) => {
  try {
    const { id } = req.params; // conversationID
    const {
      content, type = 0, mediaUrl, mediaName, mediaDuration,
      replyToID, replyToContent, isStatusReply = 0,
    } = req.body;
    const senderID = req.user.alanyaID;

    if (!content && !mediaUrl) {
      return res.status(400).json({ error: 'content ou mediaUrl requis' });
    }

    const [result] = await pool.execute(
      `INSERT INTO message
         (senderID, conversationID, content, type, status, sendAt,
          mediaUrl, mediaName, mediaDuration, replyToID, replyToContent, isStatusReply)
       VALUES (?, ?, ?, ?, 1, NOW(), ?, ?, ?, ?, ?, ?)`,
      [
        senderID, id, content ?? null, type, 
        mediaUrl ?? null, mediaName ?? null, mediaDuration ?? null,
        replyToID ?? null, replyToContent ?? null, isStatusReply,
      ]
    );

    const msgID = result.insertId;

    // Mettre à jour le résumé de la conversation
    await pool.execute(
      `UPDATE conversation
       SET lastMessage = ?, lastMessageAt = NOW(),
           lastMessageSenderID = ?, lastMessageType = ?, lastMessageStatus = 1
       WHERE conversID = ?`,
      [
        content ? content.substring(0, 200) : (mediaName ?? 'Média'),
        senderID, type, id,
      ]
    );

    // Incrémenter unreadCount pour tous les autres participants
    await pool.execute(
      'UPDATE conv_participants SET unreadCount = unreadCount + 1 WHERE conversID = ? AND alanyaID != ?',
      [id, senderID]
    );

    // Récupérer le message complet avec infos sender
    const [rows] = await pool.execute(
      `SELECT m.*, u.nom AS sender_nom, u.pseudo AS sender_pseudo, u.avatar_url AS sender_avatar
       FROM message m
       JOIN users u ON m.senderID = u.alanyaID
       WHERE m.msgID = ?`,
      [msgID]
    );

    const msg = rows[0];

    // ── Broadcast temps réel via Socket.IO ─────────────────────────────
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation_${id}`).emit('message:received', msg);

      // Émettre aussi directement aux sockets des participants qui ne
      // sont peut-être pas dans la room (app en arrière-plan mais connectée)
      const userSockets = req.app.get('userSockets');
      if (userSockets) {
        const [participants] = await pool.execute(
          'SELECT alanyaID FROM conv_participants WHERE conversID = ? AND alanyaID != ?',
          [id, senderID]
        );
        for (const p of participants) {
          const sid = userSockets.get(p.alanyaID);
          if (sid) io.to(sid).emit('message:received', msg);
        }
      }
    }

    // Notification FCM data-only aux autres participants
    const [sender] = await pool.execute(
      'SELECT nom FROM users WHERE alanyaID = ?', [senderID]
    );
    const senderName = sender[0]?.nom ?? 'Talky';
    await notifyNewMessage(id, senderID, senderName, content, type);

    res.json(msg);
  } catch (error) {
    throw error;
  }
};

const updateMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const senderID = req.user.alanyaID;

    if (!content) {
      return res.status(400).json({ error: 'content requis' });
    }

    const [existing] = await pool.execute(
      'SELECT * FROM message WHERE msgID = ? AND senderID = ? AND isDeleted = 0',
      [id, senderID]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Message introuvable ou non autorisé' });
    }

    await pool.execute(
      'UPDATE message SET content = ?, isEdited = 1, editedAt = NOW() WHERE msgID = ?',
      [content, id]
    );

    const [rows] = await pool.execute('SELECT * FROM message WHERE msgID = ?', [id]);
    const updated = rows[0];

    const io = req.app.get('io');
    if (io && updated) {
      io.to(`conversation_${updated.conversationID}`).emit('message:updated', updated);
    }

    res.json(updated);
  } catch (error) {
    throw error;
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { all } = req.query; // ?all=true → supprimer pour tout le monde
    const senderID = req.user.alanyaID;

    const [existing] = await pool.execute(
      'SELECT * FROM message WHERE msgID = ? AND senderID = ?',
      [id, senderID]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Message introuvable ou non autorisé' });
    }

    if (all === 'true') {
      // Supprimer pour tout le monde
      await pool.execute(
        'UPDATE message SET isDeleted = 1, deletedForID = NULL WHERE msgID = ?',
        [id]
      );
    } else {
      // Supprimer uniquement pour moi
      await pool.execute(
        'UPDATE message SET deletedForID = ? WHERE msgID = ?',
        [senderID, id]
      );
    }

    const io = req.app.get('io');
    if (io && existing[0]) {
      io.to(`conversation_${existing[0].conversationID}`).emit('message:deleted', {
        msgID: parseInt(id),
        conversationID: existing[0].conversationID,
        all: all === 'true',
        deletedForID: all === 'true' ? null : senderID,
      });
    }

    res.json({ message: 'Message supprimé', all: all === 'true' });
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getMessages,
  sendMessage,
  updateMessage,
  deleteMessage,
};