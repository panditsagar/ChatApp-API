const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const {
  createGroup,
  getMyGroups,
  getGroupMessages,
  sendGroupMessage,
    addMember,
  removeMember,
  uploadGroupAvatar,
  getGroupMembers,
    updateGroupName,
} = require("../controllers/group.controller");

router.post("/create", auth, createGroup);
router.get("/list", auth, getMyGroups);
router.get("/messages/:groupId", auth, getGroupMessages);
router.post("/send", auth, sendGroupMessage);

router.post("/add-member", auth, addMember);
router.post("/remove-member", auth, removeMember);
router.post("/avatar", auth, uploadGroupAvatar);
router.get("/members/:groupId", auth, getGroupMembers);
router.post("/rename", auth, updateGroupName);

module.exports = router;
