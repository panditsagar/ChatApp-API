const router = require("express").Router();
const multer = require("multer");
const auth = require("../middleware/authMiddleware");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");

// Multer: Save file temporarily to disk (FASTEST)
const upload = multer({
  storage: multer.diskStorage({}),
});

router.post("/", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Upload file directly to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "chat-app-messages",
    });

    // Remove temp file after upload
    fs.unlinkSync(req.file.path);

    return res.json({
      url: result.secure_url,
    });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

module.exports = router;
