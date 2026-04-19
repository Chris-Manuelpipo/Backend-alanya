const register = (io, socket, userSockets) => {
  socket.on('register', async (data) => {
    try {
      const { alanyaID } = data;
      if (!alanyaID) {
        socket.emit('error', { message: 'alanyaID required' });
        return;
      }
      userSockets.set(alanyaID, socket.id);
      socket.alanyaID = alanyaID;
      socket.join(`user_${alanyaID}`);
      socket.emit('registered', { success: true, alanyaID });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
};

module.exports = register;