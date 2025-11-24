const User = require("../models/user.model");

exports.getProfile = async (req, res) => {
  try {
    const uid = req.user.uid;

    const user = await User.findByUID(uid);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({
      message: "User profile fetched successfully.",
      user,
    });
  } catch (err) {
    console.error("🔥 Profile Fetch Error:", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const uid = req.user.uid;

    const { phone, bio, gender, dob, avatar, name } = req.body;

    // Update DB
    const updated = await User.updateProfile(uid, {
      phone,
      bio,
      gender,
      dob,
      avatar,
      name,
    });

    return res.json({
      message: "Profile updated successfully.",
      user: updated,
    });
  } catch (err) {
    console.error("🔥 Profile Update Error:", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const uid = req.user.uid;

    const users = await User.getAllExcept(uid);

    res.json({ users });
  } catch (error) {
    console.error("Get Users Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
