const db = require("../config/db");
const { getIo } = require("../socket");

exports.createGroup = async (req, res) => {
  try {
    const { name, members, avatar } = req.body;
    const creator = req.user.uid;

    if (!name) return res.status(400).json({ message: "Group name required" });

    // create group (WITH AVATAR)
    const [result] = await db.query(
      `INSERT INTO groups_chat (name, created_by, avatar) VALUES (?, ?, ?)`,
      [name, creator, avatar || null]
    );
    const groupId = result.insertId;

    // add creator
    await db.query(
      `INSERT INTO group_members (group_id, user_uid, role) VALUES (?, ?, 'creator')`,
      [groupId, creator]
    );

    // add other members
    if (members?.length) {
      const values = members.map((uid) => [groupId, uid, "member"]);
      await db.query(
        `INSERT INTO group_members (group_id, user_uid, role) VALUES ?`,
        [values]
      );
    }

    return res.json({ groupId });
  } catch (err) {
    console.error("createGroup error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};


exports.getMyGroups = async (req, res) => {
  try {
    const uid = req.user.uid;

    const [rows] = await db.query(
      `
      SELECT g.id, g.name, g.created_by, g.created_at, g.avatar
      FROM group_members gm
      JOIN groups_chat g ON g.id = gm.group_id
      WHERE gm.user_uid = ?
      ORDER BY g.created_at DESC
      `,
      [uid]
    );

    return res.json({ groups: rows });
  } catch (err) {
    console.error("getMyGroups error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};


exports.getGroupMessages = async (req, res) => {
  try {
    const groupId = req.params.groupId;

    const [messages] = await db.query(
      `SELECT * FROM group_messages WHERE group_id = ? ORDER BY created_at ASC`,
      [groupId]
    );

    return res.json({ messages });
  } catch (err) {
    console.error("getGroupMessages error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.sendGroupMessage = async (req, res) => {
  try {
    const sender = req.user.uid;
    const { group_id, message, type = "text", url } = req.body;

    if (!group_id || (!message && !url))
      return res.status(400).json({ message: "Missing fields" });

    const [result] = await db.query(
      `INSERT INTO group_messages (group_id, sender_uid, message, type, url)
       VALUES (?, ?, ?, ?, ?)`,
      [group_id, sender, message || "", type, url || null]
    );

    const insertId = result.insertId;

    const [msg] = await db.query(
      `SELECT * FROM group_messages WHERE id = ?`,
      [insertId]
    );

    const finalMsg = msg[0];

    const io = getIo();
    io.to(`group_${group_id}`).emit("newGroupMessage", finalMsg);

    return res.json({ msg: finalMsg });
  } catch (err) {
    console.error("sendGroupMessage error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};



exports.getGroupMembers = async (req, res) => {
  try {
    const groupId = req.params.groupId;

    const [members] = await db.query(
      `
      SELECT gm.user_uid, gm.role, u.name, u.email, u.avatar 
      FROM group_members gm 
      JOIN users u ON gm.user_uid = u.firebase_uid 
      WHERE gm.group_id = ?
      `,
      [groupId]
    );

    res.json({ members });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to fetch members" });
  }
};


exports.addMember = async (req, res) => {
  try {
    const { group_id, user_uid } = req.body;

    await db.query(
      `INSERT INTO group_members (group_id, user_uid, role) VALUES (?, ?, 'member')`,
      [group_id, user_uid]
    );

    res.json({ message: "Member added" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to add member" });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const { group_id, user_uid } = req.body;

    await db.query(
      `DELETE FROM group_members WHERE group_id=? AND user_uid=?`,
      [group_id, user_uid]
    );

    res.json({ message: "Member removed" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to remove member" });
  }
};


exports.uploadGroupAvatar = async (req, res) => {
  try {
    const { group_id, url } = req.body;

    if (!url) return res.status(400).json({ message: "No image URL" });

    await db.query(
      `UPDATE groups_chat SET avatar=? WHERE id=?`,
      [url, group_id]
    );

    res.json({ message: "Avatar updated", url });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to update avatar" });
  }
};

exports.updateGroupName = async (req, res) => {
  try {
    const { group_id, name } = req.body;

    if (!name.trim()) {
      return res.status(400).json({ message: "Name required" });
    }

    await db.query(`UPDATE groups_chat SET name=? WHERE id=?`, [name, group_id]);

    res.json({ message: "Group name updated", name });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to update name" });
  }
};
