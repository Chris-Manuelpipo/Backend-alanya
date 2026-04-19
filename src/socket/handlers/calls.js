const webrtcService = require('../../services/webrtcService');
const pool = require('../../config/db');

const callUser = (io, socket, userSockets) => {
  socket.on('call_user', async (data) => {
    try {
      const { callID, callerID, callerName, receiverID, isVideo } = data;
      const receiverSocket = userSockets.get(receiverID);
      
      webrtcService.createCall(callID, callerID, receiverID);
      
      if (receiverSocket) {
        io.to(receiverSocket).emit('incoming_call', {
          callID,
          callerID,
          callerName,
          isVideo,
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
};

const answerCall = (io, socket, userSockets) => {
  socket.on('answer_call', async (data) => {
    try {
      const { callID, callerID, receiverID, accept } = data;
      const callerSocket = userSockets.get(callerID);

      webrtcService.updateCallStatus(callID, accept ? 'active' : 'rejected');

      // Marque le VRAI début de l'appel (décrochage) pour que la durée
      // calculée dans endCall exclue le temps de sonnerie.
      if (accept) {
        try {
          await pool.execute(
            'UPDATE callHistory SET start_time = NOW(), status = 1 WHERE IDcall = ?',
            [callID]
          );
        } catch (e) {
          console.warn('[Socket answerCall] update start_time failed:', e.message);
        }
      }

      if (callerSocket) {
        io.to(callerSocket).emit('call_answered', {
          callID,
          accept,
          receiverID,
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
};

const rejectCall = (io, socket, userSockets) => {
  socket.on('reject_call', (data) => {
    const { callID, callerID, receiverID } = data;
    const callerSocket = userSockets.get(callerID);
    
    webrtcService.endCall(callID);
    
    if (callerSocket) {
      io.to(callerSocket).emit('call_rejected', { callID, receiverID });
    }
  });
};

const iceCandidate = (io, socket, userSockets) => {
  socket.on('ice_candidate', (data) => {
    const { callID, candidate, targetUserID } = data;
    const targetSocket = userSockets.get(targetUserID);
    
    if (targetSocket) {
      io.to(targetSocket).emit('ice_candidate', { callID, candidate, from: socket.alanyaID });
    }
  });
};

const endCall = (io, socket, userSockets) => {
  socket.on('end_call', (data) => {
    const { callID, userID } = data;
    webrtcService.endCall(callID);
    io.emit('call_ended', { callID, userID });
  });
};

module.exports = {
  callUser,
  answerCall,
  rejectCall,
  iceCandidate,
  endCall,
};