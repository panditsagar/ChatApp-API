require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/user", require("./routes/user.routes"));
app.use("/api/upload", require("./routes/upload.routes"));
app.use("/api/chat", require("./routes/chat.routes"));
app.use("/api/group", require("./routes/group.routes"));


module.exports = app;  // IMPORTANT — do NOT start server here
