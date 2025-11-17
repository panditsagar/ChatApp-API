const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const {
  getProfile,
  updateProfile,
  getAllUsers,
} = require("../controllers/user.controller");

// Get logged-in user profile
router.get("/profile", auth, getProfile);

// Update profile
router.put("/update", auth, updateProfile);

// Get All Users (for chat selection)
router.get("/all", auth, getAllUsers);

module.exports = router;
