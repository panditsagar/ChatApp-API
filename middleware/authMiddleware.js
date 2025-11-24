const admin = require("../config/firebaseAdmin");

module.exports = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ message: "Missing token" });

    const token = header.split(" ")[1];

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;

    next();

  } catch (error) {
    res.status(401).json({ message: "Invalid token", error });
  }
};
