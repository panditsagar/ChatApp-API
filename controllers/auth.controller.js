const User = require("../models/user.model");
const admin = require("../config/firebaseAdmin");

exports.verifyUser = async (req, res) => {
  try {
    const { uid, email } = req.user;

    // ALWAYS FETCH FROM ADMIN SDK
    const firebaseUser = await admin.auth().getUser(uid);

    const name =
      firebaseUser.displayName && firebaseUser.displayName.trim() !== ""
        ? firebaseUser.displayName
        : "User"; // default fallback

    const picture = firebaseUser.photoURL || null;

    // Check if exists
    let user = await User.findByUID(uid);
    if (user) {
      return res.json({ status: "existing", user });
    }

    // Create
    const newUser = await User.create(uid, name, email, picture);

    return res.json({
      status: "created",
      user: newUser,
    });

  } catch (error) {
    console.error("🔥 VerifyUser Error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
