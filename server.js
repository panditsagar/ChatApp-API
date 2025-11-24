// server.js
const http = require("http");
const { Server } = require("socket.io");
const app = require("./index");
const socketHelper = require("./socket");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

socketHelper.setIo(io);

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
   socket.on("joinGroup", (groupId) => {
  socket.join(`group_${groupId}`);
});

socket.on("leaveGroup", (groupId) => {
  socket.leave(`group_${groupId}`);
});

  // client should emit "userOnline" with their firebase_uid after connecting
  socket.on("userOnline", (uid) => {
    if (!uid) return;
    socketHelper.addSocketForUser(uid, socket.id);
    // mark online and broadcast presence update
    socketHelper.setUserOnline(uid, true);
    io.emit("presenceUpdate", { uid, online: true, last_active: socketHelper.getLastActive(uid) });
    console.log("userOnline:", uid, "socket:", socket.id);
  });

  socket.on("join", (chatId) => {
    if (!chatId) return;
    socket.join(String(chatId));
    // console.log(`${socket.id} joined ${chatId}`);
  });

  socket.on("leave", (chatId) => {
    if (!chatId) return;
    socket.leave(String(chatId));
  });

  // typing indicator (broadcast to room except sender)
  socket.on("typing", ({ chatId, uid, isTyping }) => {
    if (!chatId) return;
    socket.to(String(chatId)).emit("typing", { chatId, uid, isTyping });
  });

  // delivered ack: recipient should emit this when it receives the message
  socket.on("messageDelivered", ({ chatId, messageId, uid }) => {
    if (!chatId || !messageId) return;
    io.to(String(chatId)).emit("messageDelivered", { chatId, messageId, uid, delivered_at: new Date().toISOString() });
  });

  // seen ack: recipient emits when opening the chat (marks many messages as seen)
// seen ack: recipient emits when opening the chat (marks many messages as seen)
socket.on("messageSeen", async ({ chatId, messageIds = [], uid }) => {
  if (!chatId || !uid) return;

  try {
    const ChatController = require("./controllers/chat.controller");

    // 1. Update messages in DB
    await ChatController.markMessagesSeenSocketHandler(chatId, messageIds, uid);

    // 2. Emit to chat room (so ticks update)
    io.to(String(chatId)).emit("messageSeen", {
      chatId,
      messageIds,
      uid,
      seen_at: new Date().toISOString(),
    });

    // 3. Emit sidebar refresh with correct property
    io.emit("chatUpdated", { chatId });  // ← FIXED

  } catch (err) {
    console.error("messageSeen handler error:", err);
  }
});


  socket.on("disconnect", () => {
    // remove socket mapping
    socketHelper.removeSocket(socket.id);
    // optionally emit presence changes (we don't have uid here easily)
    io.emit("presenceChanged");
    // console.log("socket disconnected", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
