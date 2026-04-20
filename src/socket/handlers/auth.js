const register = (io, socket, userSockets) => {
  socket.on('register', async (data) => {
    try {
      // Accepte deux formes :
      //   { alanyaID: 42 }  → SocketService (correct)
      //   "42" ou 42        → CallService (avant correction F2)
      let alanyaID;
      if (data !== null && typeof data === 'object') {
        alanyaID = parseInt(data.alanyaID, 10);
      } else {
        alanyaID = parseInt(data, 10);
      }

      if (!alanyaID || isNaN(alanyaID)) {
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