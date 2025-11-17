const router = require("express").Router();
const { verifyUser } = require("../controllers/auth.controller");
const auth = require("../middleware/authMiddleware");

router.post("/verify", auth, verifyUser);

module.exports = router;
