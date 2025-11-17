// socket.js
let io = null;

// in-memory structures (dev-only). For production use Redis.
const userSockets = {};   // uid -> Set(socketId)
const socketToUser = {};  // socketId -> uid
const lastActive = {};    // uid -> ISO string
const onlineMap = {};     // uid -> boolean

function setIo(serverIo) {
  io = serverIo;
}
function getIo() { return io; }

function addSocketForUser(uid, socketId) {
  socketToUser[socketId] = uid;
  if (!userSockets[uid]) userSockets[uid] = new Set();
  userSockets[uid].add(socketId);
  onlineMap[uid] = true;
  lastActive[uid] = new Date().toISOString();
}
function removeSocket(socketId) {
  const uid = socketToUser[socketId];
  if (!uid) return;
  delete socketToUser[socketId];
  const set = userSockets[uid];
  if (set) {
    set.delete(socketId);
    if (set.size === 0) {
      delete userSockets[uid];
      onlineMap[uid] = false;
      lastActive[uid] = new Date().toISOString();
    }
  }
}
function getUserSocketIds(uid) {
  return userSockets[uid] ? Array.from(userSockets[uid]) : [];
}
function getLastActive(uid) {
  return lastActive[uid] || null;
}
function isUserOnline(uid) {
  return !!onlineMap[uid];
}
function setUserOnline(uid, flag) {
  onlineMap[uid] = !!flag;
  if (flag) lastActive[uid] = new Date().toISOString();
}

module.exports = {
  setIo, getIo,
  addSocketForUser, removeSocket, getUserSocketIds,
  getLastActive, isUserOnline, setUserOnline,
};
