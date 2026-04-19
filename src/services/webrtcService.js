const activeCalls = new Map();

const createCall = (callID, callerID, receiverID) => {
  activeCalls.set(callID, {
    callID,
    callerID,
    receiverID,
    status: 'ringing',
    startTime: null,
  });
};

const getCall = (callID) => {
  return activeCalls.get(callID);
};

const updateCallStatus = (callID, status) => {
  const call = activeCalls.get(callID);
  if (call) {
    call.status = status;
    if (status === 'active') {
      call.startTime = new Date();
    }
  }
};

const endCall = (callID) => {
  activeCalls.delete(callID);
};

const getActiveCalls = () => {
  return Array.from(activeCalls.values());
};

module.exports = {
  createCall,
  getCall,
  updateCallStatus,
  endCall,
  getActiveCalls,
};