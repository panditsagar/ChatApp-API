const router = require("express").Router();
const auth = require("../middleware/authMiddleware");

const {
  startChat,
  getChats,
  getMessages,
  sendMessage,
} = require("../controllers/chat.controller");

router.post("/start", auth, startChat);
router.get("/list", auth, getChats);
router.get("/messages/:chatId", auth, getMessages);
router.post("/send", auth, sendMessage);

module.exports = router;
