// src/socket/handlers/meetings.js
// meetingJoinRoom est maintenant exporté et DOIT être enregistré dans server.js

function toInt(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

const meetingCreate = (io, socket, userSockets) => {
  socket.on('meeting:create', async (data) => {
    try {
      if (!socket.authenticated) return;
      const { meetingID, organiserID, meetingName } = data;
      socket.join(`meeting_${meetingID}`);
      socket.currentMeetingID = meetingID;
      socket.emit('meeting:created', { meetingID, meetingName });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
};

// CORRIGÉ : était défini mais jamais exporté ni enregistré dans server.js
const meetingJoinRoom = (io, socket, userSockets) => {
  socket.on('meeting:join_room', (data) => {
    try {
      if (!socket.authenticated) return;
      const { meetingID, userID } = data;
      const mID = toInt(meetingID);
      const uID = toInt(userID) || socket.alanyaID;

      if (!mID) {
        return socket.emit('error', { message: 'meetingID requis' });
      }

      socket.join(`meeting_${mID}`);
      socket.currentMeetingID = mID;

      socket.emit('meeting:room_joined', { meetingID: mID, userID: uID });

      socket.to(`meeting_${mID}`).emit('meeting:user_joined', {
        meetingID: mID,
        userID:    String(uID),
      });
    } catch (error) {
      console.error('[Socket meeting:join_room]', error.message);
      socket.emit('error', { message: error.message });
    }
  });
};

const meetingJoinRequest = (io, socket, userSockets) => {
  socket.on('meeting:join_request', async (data) => {
    try {
      if (!socket.authenticated) return;
      const { meetingID, userID, userName } = data;
      socket.to(`meeting_${meetingID}`).emit('meeting:join_requested', {
        meetingID,
        userID,
        userName,
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
};

const meetingJoinAccept = (io, socket, userSockets) => {
  socket.on('meeting:join_accept', (data) => {
    if (!socket.authenticated) return;
    const { meetingID, userID } = data;
    const userSocket = userSockets.get(toInt(userID));

    if (userSocket) {
      io.to(userSocket).emit('meeting:accepted', { meetingID });
    }
    socket.to(`meeting_${meetingID}`).emit('meeting:user_joined', { meetingID, userID });
  });
};

const meetingJoinDecline = (io, socket, userSockets) => {
  socket.on('meeting:join_decline', (data) => {
    if (!socket.authenticated) return;
    const { meetingID, userID } = data;
    const userSocket = userSockets.get(toInt(userID));

    if (userSocket) {
      io.to(userSocket).emit('meeting:declined', { meetingID });
    }
  });
};

const meetingStart = (io, socket, userSockets) => {
  socket.on('meeting:start', (data) => {
    if (!socket.authenticated) return;
    const { meetingID } = data;
    io.to(`meeting_${meetingID}`).emit('meeting:started', { meetingID });
  });
};

const meetingEnd = (io, socket, userSockets) => {
  socket.on('meeting:end', (data) => {
    if (!socket.authenticated) return;
    const { meetingID } = data;
    io.to(`meeting_${meetingID}`).emit('meeting:ended', { meetingID });

    const roomSockets = io.sockets.adapter.rooms.get(`meeting_${meetingID}`);
    if (roomSockets) {
      for (const sid of roomSockets) {
        const s = io.sockets.sockets.get(sid);
        if (s) {
          s.leave(`meeting_${meetingID}`);
          s.currentMeetingID = null;
        }
      }
    }
  });
};

const meetingChat = (io, socket, userSockets) => {
  socket.on('meeting:chat', (data) => {
    if (!socket.authenticated) return;
    const { meetingID, userID, message } = data;
    io.to(`meeting_${meetingID}`).emit('meeting:message', {
      meetingID,
      userID,
      message,
      sendAt: new Date(),
    });
  });
};

const meetingLeave = (io, socket, userSockets) => {
  socket.on('meeting:leave', (data) => {
    try {
      const meetingID = data?.meetingID || socket.currentMeetingID;
      if (!meetingID) return;

      socket.to(`meeting_${meetingID}`).emit('meeting:user_left', {
        meetingID,
        userID: String(socket.alanyaID),
      });

      socket.leave(`meeting_${meetingID}`);
      socket.currentMeetingID = null;
    } catch (error) {
      console.error('[Socket meeting:leave]', error.message);
    }
  });
};

const meetingOffer = (io, socket, userSockets) => {
  socket.on('meeting:offer', (data) => {
    try {
      if (!socket.authenticated) return;
      const { meetingID, toUserID, offer } = data;
      const targetID = toInt(toUserID);
      if (!targetID || !offer) return;

      const targetSocketId = userSockets.get(targetID);
      if (targetSocketId) {
        io.to(targetSocketId).emit('meeting:offer', {
          fromUserID: String(socket.alanyaID),
          offer,
          meetingID,
        });
      }
    } catch (error) {
      console.error('[Socket meeting:offer]', error.message);
    }
  });
};

const meetingAnswer = (io, socket, userSockets) => {
  socket.on('meeting:answer', (data) => {
    try {
      if (!socket.authenticated) return;
      const { meetingID, toUserID, answer } = data;
      const targetID = toInt(toUserID);
      if (!targetID || !answer) return;

      const targetSocketId = userSockets.get(targetID);
      if (targetSocketId) {
        io.to(targetSocketId).emit('meeting:answer', {
          fromUserID: String(socket.alanyaID),
          answer,
          meetingID,
        });
      }
    } catch (error) {
      console.error('[Socket meeting:answer]', error.message);
    }
  });
};

const meetingIceCandidate = (io, socket, userSockets) => {
  socket.on('meeting:ice_candidate', (data) => {
    try {
      if (!socket.authenticated) return;
      const { meetingID, toUserID, candidate } = data;
      const targetID = toInt(toUserID);
      if (!targetID || !candidate) return;

      const targetSocketId = userSockets.get(targetID);
      if (targetSocketId) {
        io.to(targetSocketId).emit('meeting:ice_candidate', {
          fromUserID: String(socket.alanyaID),
          candidate,
          meetingID,
        });
      }
    } catch (error) {
      console.error('[Socket meeting:ice_candidate]', error.message);
    }
  });
};

module.exports = {
  meetingCreate,
  meetingJoinRoom,      // ← MAINTENANT EXPORTÉ
  meetingJoinRequest,
  meetingJoinAccept,
  meetingJoinDecline,
  meetingStart,
  meetingEnd,
  meetingChat,
  meetingLeave,
  meetingOffer,
  meetingAnswer,
  meetingIceCandidate,
};