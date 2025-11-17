// controllers/chat.controller.js
const Chat = require("../models/chat.model");
const socketHelper = require("../socket");
const { getIo } = require("../socket");

exports.startChat = async (req, res) => {
  try {
    const user1 = req.user.uid;
    const user2 = req.body.receiver_uid;
    if (!user2) return res.status(400).json({ message: "Receiver UID required" });

    let chat = await Chat.findChat(user1, user2);
    if (chat) return res.json({ chat });

    const newChat = await Chat.createChat(user1, user2);
    return res.json({ chat: newChat });
  } catch (err) {
    console.error("startChat error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getChats = async (req, res) => {
  try {
    const uid = req.user.uid;
    const chats = await Chat.getUserChats(uid);
    return res.json({ chats });
  } catch (err) {
    console.error("getChats error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const messages = await Chat.getMessages(chatId);
    return res.json({ messages });
  } catch (err) {
    console.error("getMessages error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const sender = req.user.uid;
    const { chat_id, message, type = "text", url } = req.body;

    if (!chat_id || (!message && !url)) {
      return res.status(400).json({ message: "chat_id and message or url required" });
    }

    // determine recipient (other user in chat)
    const chat = await Chat.getChatById(chat_id);
    if (!chat) return res.status(400).json({ message: "Chat not found" });

    const recipient = chat.user1_uid === sender ? chat.user2_uid : chat.user1_uid;

    // save message (model returns inserted row with created_at)
    const saved = await Chat.sendMessage(chat_id, sender, message || "", type, url || null, recipient);

    // update chats table last_message + unread counters
    await Chat.updateChatLastMessage(chat_id, message || (url ? "[image]" : ""), sender, recipient);

    // build emitted object
    const emitted = {
      id: saved.id,
      chat_id,
      sender_uid: sender,
      receiver_uid: recipient,
      message: saved.message,
      type: saved.type,
      url: saved.url,
      status: saved.status || "sent",
      created_at: saved.created_at,
    };

    // emit to chat room
    const io = getIo();
    if (io) {
      io.to(String(chat_id)).emit("newMessage", emitted);

      // also emit chatUpdated to both participants (frontend refresh / reorder)
      // Optionally emit to specific user rooms; simple approach: global emit
      io.emit("chatUpdated", { chat_id });
    }

    return res.json({ msg: emitted });
  } catch (err) {
    console.error("sendMessage error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Helper used by socket messageSeen handler to mark messages seen in DB & reset unread counters
exports.markMessagesSeenSocketHandler = async (chatId, messageIds, uid) => {
  try {
    await Chat.markMessagesSeen(chatId, messageIds, uid);
    // reset unread for this chat for this uid
    await Chat.resetChatUnreadForUser(chatId, uid);
  } catch (err) {
    console.error("markMessagesSeenSocketHandler err:", err);
    throw err;
  }
};
