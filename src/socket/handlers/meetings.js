const meetingCreate = (io, socket, userSockets) => {
  socket.on('meeting:create', async (data) => {
    try {
      const { meetingID, organiserID, meetingName } = data;
      socket.join(`meeting_${meetingID}`);
      socket.emit('meeting:created', { meetingID, meetingName });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
};

const meetingJoinRequest = (io, socket, userSockets) => {
  socket.on('meeting:join_request', async (data) => {
    try {
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
    const { meetingID, userID } = data;
    const userSocket = userSockets.get(userID);
    
    if (userSocket) {
      io.to(userSocket).emit('meeting:accepted', { meetingID });
    }
    socket.join(`meeting_${meetingID}`);
    socket.to(`meeting_${meetingID}`).emit('meeting:user_joined', { userID });
  });
};

const meetingJoinDecline = (io, socket, userSockets) => {
  socket.on('meeting:join_decline', (data) => {
    const { meetingID, userID } = data;
    const userSocket = userSockets.get(userID);
    
    if (userSocket) {
      io.to(userSocket).emit('meeting:declined', { meetingID });
    }
  });
};

const meetingStart = (io, socket, userSockets) => {
  socket.on('meeting:start', (data) => {
    const { meetingID } = data;
    io.to(`meeting_${meetingID}`).emit('meeting:started', { meetingID });
  });
};

const meetingEnd = (io, socket, userSockets) => {
  socket.on('meeting:end', (data) => {
    const { meetingID } = data;
    io.to(`meeting_${meetingID}`).emit('meeting:ended', { meetingID });
    socket.leave(`meeting_${meetingID}`);
  });
};

const meetingChat = (io, socket, userSockets) => {
  socket.on('meeting:chat', (data) => {
    const { meetingID, userID, message } = data;
    io.to(`meeting_${meetingID}`).emit('meeting:message', {
      meetingID,
      userID,
      message,
      sendAt: new Date(),
    });
  });
};

module.exports = {
  meetingCreate,
  meetingJoinRequest,
  meetingJoinAccept,
  meetingJoinDecline,
  meetingStart,
  meetingEnd,
  meetingChat,
};