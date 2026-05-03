// src/socket/handlers/calls.js
//
// Protocole aligné sur Flutter CallService.
//
// ── Appels 1-à-1 ──────────────────────────────────────────────────────
// Flutter → Serveur
//   call_user        { targetUserId, callerId, callerName, callerPhoto, isVideo, offer:{sdp,type} }
//   answer_call      { callerId, answer:{sdp,type} }
//   reject_call      { callerId }
//   end_call         { targetUserId }
//   ice_candidate    { targetUserId, candidate:{candidate,sdpMid,sdpMLineIndex} }
//
// Serveur → Flutter
//   incoming_call    { callerId, callerName, callerPhoto, isVideo, offer:{sdp,type} }
//   call_answered    { answer:{sdp,type} }
//   call_rejected    {}
//   call_ended       {}
//   ice_candidate    { candidate:{candidate,sdpMid,sdpMLineIndex} }
//
// ── Appels de groupe ──────────────────────────────────────────────────
// Flutter → Serveur
//   create_group_call  { roomId, callerId, callerName, callerPhoto, isVideo, targetUserIds:[] }
//   join_group_call    { roomId, userId, userName, userPhoto }
//   leave_group_call   { roomId }
//   end_group_call     { roomId }
//   group_offer        { roomId, fromUserId, toUserId, offer:{sdp,type} }
//   group_answer       { roomId, fromUserId, toUserId, answer:{sdp,type} }
//   group_ice_candidate{ roomId, fromUserId, toUserId, candidate:{...} }
//
// Serveur → Flutter
//   group_call_invite  { callerId, callerName, callerPhoto, isVideo, roomId }
//   group_user_joined  { roomId, userId, userName, userPhoto }
//   group_participants { roomId, participants:[] }
//   group_offer        { fromUserId, offer:{sdp,type} }
//   group_answer       { fromUserId, answer:{sdp,type} }
//   group_ice_candidate{ fromUserId, candidate:{...} }
//   group_call_ended   {}
//   group_user_left    { roomId, userId }

const pool = require('../../config/db');

// State en mémoire des rooms de groupe
// roomId → Map<alanyaID, { userName, userPhoto }>
const groupRooms = new Map();

function toInt(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

// ─────────────────────────────────────────────────────────────────────
//  APPELS 1-À-1
// ─────────────────────────────────────────────────────────────────────

const callUser = (io, socket, userSockets) => {
  socket.on('call_user', async (data) => {
    try {
      if (!socket.authenticated) return;

      const { targetUserId, callerId, callerName, callerPhoto, isVideo, offer } = data;
      const targetID = toInt(targetUserId);
      const callerID = toInt(callerId) || socket.alanyaID;

      if (!targetID || !offer) {
        socket.emit('call_failed', { reason: 'Données d\'appel invalides' });
        return;
      }

      try {
        const [result] = await pool.execute(
          `INSERT INTO callHistory (idCaller, idReceiver, type, status, created_at, start_time)
           VALUES (?, ?, ?, 0, NOW(), NOW())`,
          [callerID, targetID, isVideo ? 1 : 0]
        );
        socket.currentCallID = result.insertId;
        socket.currentCallTarget = targetID;
      } catch (dbErr) {
        console.warn('[Socket call_user] DB insert failed:', dbErr.message);
      }

      const targetSocketId = userSockets.get(targetID);
      if (targetSocketId) {
        io.to(targetSocketId).emit('incoming_call', {
          callerId:    String(callerID),
          callerName:  callerName  || '',
          callerPhoto: callerPhoto || null,
          isVideo:     isVideo     || false,
          offer,
        });
      } else {
        socket.emit('call_failed', { reason: 'Utilisateur non disponible' });
      }
    } catch (error) {
      console.error('[Socket call_user]', error.message);
      socket.emit('call_failed', { reason: error.message });
    }
  });
};

const answerCall = (io, socket, userSockets) => {
  socket.on('answer_call', async (data) => {
    try {
      if (!socket.authenticated) return;
      const { callerId, answer } = data;

      const callerID   = toInt(callerId);
      const receiverID = socket.alanyaID;
      if (!callerID || !answer) return;

      // CORRIGÉ : subquery pour éviter UPDATE + ORDER BY + LIMIT
      try {
        await pool.execute(
          `UPDATE callHistory
           SET start_time = NOW(), status = 1
           WHERE IDcall = (
             SELECT IDcall FROM (
               SELECT IDcall FROM callHistory
               WHERE idCaller = ? AND idReceiver = ?
               ORDER BY created_at DESC
               LIMIT 1
             ) AS sub
           )`,
          [callerID, receiverID]
        );
      } catch (dbErr) {
        console.warn('[Socket answer_call] DB update failed:', dbErr.message);
      }

      const callerSocketId = userSockets.get(callerID);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call_answered', { answer });
      }
    } catch (error) {
      console.error('[Socket answer_call]', error.message);
    }
  });
};

const rejectCall = (io, socket, userSockets) => {
  socket.on('reject_call', async (data) => {
    try {
      if (!socket.authenticated) return;
      const { callerId } = data;
      const callerID   = toInt(callerId);
      const receiverID = socket.alanyaID;
      if (!callerID) return;

      // CORRIGÉ : subquery pour éviter UPDATE + ORDER BY + LIMIT
      try {
        await pool.execute(
          `UPDATE callHistory
           SET status = 2
           WHERE IDcall = (
             SELECT IDcall FROM (
               SELECT IDcall FROM callHistory
               WHERE idCaller = ? AND idReceiver = ?
               ORDER BY created_at DESC
               LIMIT 1
             ) AS sub
           )`,
          [callerID, receiverID]
        );
      } catch (dbErr) {
        console.warn('[Socket reject_call] DB update failed:', dbErr.message);
      }

      const callerSocketId = userSockets.get(callerID);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call_rejected', {});
      }
    } catch (error) {
      console.error('[Socket reject_call]', error.message);
    }
  });
};

const iceCandidate = (io, socket, userSockets) => {
  socket.on('ice_candidate', (data) => {
    try {
      if (!socket.authenticated) return;
      const { targetUserId, candidate } = data;
      const targetID = toInt(targetUserId);
      if (!targetID || !candidate) return;

      const targetSocketId = userSockets.get(targetID);
      if (targetSocketId) {
        io.to(targetSocketId).emit('ice_candidate', { candidate });
      }
    } catch (error) {
      console.error('[Socket ice_candidate]', error.message);
    }
  });
};

const endCall = (io, socket, userSockets) => {
  socket.on('end_call', async (data) => {
    try {
      if (!socket.authenticated) return;
      const { targetUserId } = data;
      const targetID = toInt(targetUserId);
      const callerID = socket.alanyaID;

      if (callerID) {
        try {
          await pool.execute(
            `UPDATE callHistory
             SET duree = GREATEST(0, TIMESTAMPDIFF(SECOND, start_time, NOW()))
             WHERE IDcall = (
               SELECT IDcall FROM (
                 SELECT IDcall FROM callHistory
                 WHERE (idCaller = ? OR idReceiver = ?)
                   AND (idCaller = ? OR idReceiver = ?)
                 ORDER BY created_at DESC
                 LIMIT 1
               ) AS sub
             )`,
            [callerID, callerID, targetID || callerID, targetID || callerID]
          );
        } catch (dbErr) {
          console.warn('[Socket end_call] DB update failed:', dbErr.message);
        }
      }

      if (targetID) {
        const targetSocketId = userSockets.get(targetID);
        if (targetSocketId) {
          io.to(targetSocketId).emit('call_ended', {});
        }
      }

      socket.currentCallID     = null;
      socket.currentCallTarget = null;
    } catch (error) {
      console.error('[Socket end_call]', error.message);
    }
  });
};

// ─────────────────────────────────────────────────────────────────────
//  APPELS DE GROUPE
// ─────────────────────────────────────────────────────────────────────

const createGroupCall = (io, socket, userSockets) => {
  socket.on('create_group_call', (data) => {
    try {
      if (!socket.authenticated) return;
      const { roomId, callerId, callerName, callerPhoto, isVideo, targetUserIds } = data;
      if (!roomId || !Array.isArray(targetUserIds)) return;

      const callerID = toInt(callerId) || socket.alanyaID;

      groupRooms.set(roomId, new Map([[
        callerID,
        { userName: callerName || '', userPhoto: callerPhoto || null },
      ]]));

      socket.join(`group_${roomId}`);
      socket.currentGroupRoom = roomId;

      for (const uid of targetUserIds) {
        const targetID = toInt(uid);
        if (!targetID) continue;
        const targetSocketId = userSockets.get(targetID);
        if (targetSocketId) {
          io.to(targetSocketId).emit('group_call_invite', {
            callerId:    String(callerID),
            callerName:  callerName  || '',
            callerPhoto: callerPhoto || null,
            isVideo:     isVideo     || false,
            roomId,
          });
        }
      }
    } catch (error) {
      console.error('[Socket create_group_call]', error.message);
    }
  });
};

const joinGroupCall = (io, socket, userSockets) => {
  socket.on('join_group_call', (data) => {
    try {
      if (!socket.authenticated) return;
      const { roomId, userId, userName, userPhoto } = data;
      if (!roomId || !userId) return;

      const userID = toInt(userId) || socket.alanyaID;

      if (!groupRooms.has(roomId)) {
        groupRooms.set(roomId, new Map());
      }

      const room = groupRooms.get(roomId);
      room.set(userID, { userName: userName || '', userPhoto: userPhoto || null });

      socket.join(`group_${roomId}`);
      socket.currentGroupRoom = roomId;

      socket.to(`group_${roomId}`).emit('group_user_joined', {
        roomId,
        userId:    String(userID),
        userName:  userName  || '',
        userPhoto: userPhoto || null,
      });

      const participants = Array.from(room.keys()).map(String);
      socket.emit('group_participants', { roomId, participants });
    } catch (error) {
      console.error('[Socket join_group_call]', error.message);
    }
  });
};

const leaveGroupCall = (io, socket, userSockets) => {
  socket.on('leave_group_call', (data) => {
    try {
      const { roomId } = data || {};
      const room = roomId ? groupRooms.get(roomId) : null;

      if (room && socket.alanyaID) {
        room.delete(socket.alanyaID);
        if (room.size === 0) groupRooms.delete(roomId);
      }

      const rId = roomId || socket.currentGroupRoom;
      if (rId) {
        socket.to(`group_${rId}`).emit('group_user_left', {
          roomId: rId,
          userId: String(socket.alanyaID),
        });
        socket.leave(`group_${rId}`);
      }

      socket.currentGroupRoom = null;
    } catch (error) {
      console.error('[Socket leave_group_call]', error.message);
    }
  });
};

const endGroupCall = (io, socket, userSockets) => {
  socket.on('end_group_call', (data) => {
    try {
      const { roomId } = data || {};
      const rId = roomId || socket.currentGroupRoom;
      if (!rId) return;

      groupRooms.delete(rId);
      io.to(`group_${rId}`).emit('group_call_ended', {});

      const roomSockets = io.sockets.adapter.rooms.get(`group_${rId}`);
      if (roomSockets) {
        for (const sid of roomSockets) {
          const s = io.sockets.sockets.get(sid);
          if (s) {
            s.leave(`group_${rId}`);
            s.currentGroupRoom = null;
          }
        }
      }
    } catch (error) {
      console.error('[Socket end_group_call]', error.message);
    }
  });
};

const groupOffer = (io, socket, userSockets) => {
  socket.on('group_offer', (data) => {
    try {
      if (!socket.authenticated) return;
      const { toUserId, fromUserId, offer, roomId } = data;
      const targetID = toInt(toUserId);
      if (!targetID || !offer) return;

      const targetSocketId = userSockets.get(targetID);
      if (targetSocketId) {
        io.to(targetSocketId).emit('group_offer', {
          fromUserId: String(fromUserId || socket.alanyaID),
          offer,
          roomId,
        });
      }
    } catch (error) {
      console.error('[Socket group_offer]', error.message);
    }
  });
};

const groupAnswer = (io, socket, userSockets) => {
  socket.on('group_answer', (data) => {
    try {
      if (!socket.authenticated) return;
      const { toUserId, fromUserId, answer, roomId } = data;
      const targetID = toInt(toUserId);
      if (!targetID || !answer) return;

      const targetSocketId = userSockets.get(targetID);
      if (targetSocketId) {
        io.to(targetSocketId).emit('group_answer', {
          fromUserId: String(fromUserId || socket.alanyaID),
          answer,
          roomId,
        });
      }
    } catch (error) {
      console.error('[Socket group_answer]', error.message);
    }
  });
};

const groupIceCandidate = (io, socket, userSockets) => {
  socket.on('group_ice_candidate', (data) => {
    try {
      if (!socket.authenticated) return;
      const { toUserId, fromUserId, candidate, roomId } = data;
      const targetID = toInt(toUserId);
      if (!targetID || !candidate) return;

      const targetSocketId = userSockets.get(targetID);
      if (targetSocketId) {
        io.to(targetSocketId).emit('group_ice_candidate', {
          fromUserId: String(fromUserId || socket.alanyaID),
          candidate,
          roomId,
        });
      }
    } catch (error) {
      console.error('[Socket group_ice_candidate]', error.message);
    }
  });
};

module.exports = {
  callUser,
  answerCall,
  rejectCall,
  iceCandidate,
  endCall,
  createGroupCall,
  joinGroupCall,
  leaveGroupCall,
  endGroupCall,
  groupOffer,
  groupAnswer,
  groupIceCandidate,
};