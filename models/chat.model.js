// models/chat.model.js
const db = require("../config/db");

class ChatModel {
  // find chat between two users
  static async findChat(user1, user2) {
    const [rows] = await db.query(
      `SELECT * FROM chats WHERE (user1_uid = ? AND user2_uid = ?) OR (user1_uid = ? AND user2_uid = ?) LIMIT 1`,
      [user1, user2, user2, user1]
    );
    return rows[0];
  }

  static async createChat(user1, user2) {
    const [result] = await db.query(
      `INSERT INTO chats (user1_uid, user2_uid, created_at) VALUES (?, ?, NOW())`,
      [user1, user2]
    );
    const [rows] = await db.query(`SELECT * FROM chats WHERE id = ?`, [result.insertId]);
    return rows[0];
  }

  static async getChatById(chatId) {
    const [rows] = await db.query(`SELECT * FROM chats WHERE id = ?`, [chatId]);
    return rows[0];
  }

  // get user chats with other participant info, last message, unread counts, online etc.
  static async getUserChats(uid) {
    // returns chat_id, name, email, avatar, firebase_uid (other), last_message, last_message_at, unread for this uid
    // We will detect the "other" user by joining users table twice or using logic
    const [rows] = await db.query(
      `
      SELECT 
        c.id AS chat_id,
        CASE WHEN c.user1_uid = ? THEN c.user2_uid ELSE c.user1_uid END AS firebase_uid,
        u.name, u.email, u.avatar,
        c.last_message,
        c.last_message_at,
        c.user1_unread,
        c.user2_unread
      FROM chats c
      JOIN users u ON u.firebase_uid = (CASE WHEN c.user1_uid = ? THEN c.user2_uid ELSE c.user1_uid END)
      WHERE c.user1_uid = ? OR c.user2_uid = ?
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
      `,
      [uid, uid, uid, uid]
    );

    // map unread to 'unread' numeric per current uid
    const mapped = rows.map((r) => {
      const unread = r.user1_unread === undefined ? 0 : (r.firebase_uid === r.firebase_uid ? 0 : 0);
      // We need correct unread per user: fetch chat row to determine which side this uid is
      // Simpler: run quick lookup for each chat; but to avoid extra DB calls, compute below:
      return {
        chat_id: r.chat_id,
        firebase_uid: r.firebase_uid,
        name: r.name,
        email: r.email,
        avatar: r.avatar,
        last_message: r.last_message,
        last_message_at: r.last_message_at,
        // unread will be filled with separate query below
      };
    });

    // Instead of complex mapping in SQL, return rows and allow controller to map unread by reading chats table
    // So fetch chats table rows for these chat ids
    const chatIds = rows.map((r) => r.chat_id);
    if (chatIds.length === 0) return [];

    const [chatRows] = await db.query(
      `SELECT id, user1_uid, user2_uid, user1_unread, user2_unread, last_message, last_message_at FROM chats WHERE id IN (${chatIds.map(()=>'?').join(',')})`,
      chatIds
    );

    const chatMap = {};
    for (const cr of chatRows) chatMap[cr.id] = cr;

    // build final list
    const final = rows.map((r) => {
      const c = chatMap[r.chat_id];
      let unread = 0;
      if (c) {
        if (c.user1_uid === uid) unread = c.user1_unread || 0;
        else if (c.user2_uid === uid) unread = c.user2_unread || 0;
      }
      return {
        chat_id: r.chat_id,
        firebase_uid: r.firebase_uid,
        name: r.name,
        email: r.email,
        avatar: r.avatar,
        last_message: c?.last_message || null,
        last_message_at: c?.last_message_at || null,
        unread,
      };
    });

    return final;
  }

  static async getMessages(chatId) {
    const [rows] = await db.query(
      `SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC`,
      [chatId]
    );
    return rows;
  }

  // insert message and return the inserted row
  static async sendMessage(chatId, senderUid, message, type = "text", url = null, receiverUid = null) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO messages (chat_id, sender_uid, receiver_uid, message, type, url, status, unread, created_at) VALUES (?, ?, ?, ?, ?, ?, 'sent', 1, NOW())`,
        [chatId, senderUid, receiverUid, message, type, url]
      );

      const insertedId = result.insertId;
      const [rows] = await conn.query(`SELECT * FROM messages WHERE id = ?`, [insertedId]);

      await conn.commit();
      conn.release();
      return rows[0];
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  }

  // update chats table last_message + increment unread for recipient
  static async updateChatLastMessage(chatId, lastMessage, senderUid, recipientUid) {
    // determine which column to increment (user1_unread or user2_unread)
    const [rows] = await db.query(`SELECT user1_uid, user2_uid, user1_unread, user2_unread FROM chats WHERE id = ?`, [chatId]);
    const chat = rows[0];
    if (!chat) return;

    let user1_unread = chat.user1_unread || 0;
    let user2_unread = chat.user2_unread || 0;

    if (chat.user1_uid === recipientUid) user1_unread = (user1_unread || 0) + 1;
    if (chat.user2_uid === recipientUid) user2_unread = (user2_unread || 0) + 1;

    await db.query(
      `UPDATE chats SET last_message = ?, last_message_at = NOW(), last_message_by = ?, user1_unread = ?, user2_unread = ? WHERE id = ?`,
      [lastMessage, senderUid, user1_unread, user2_unread, chatId]
    );
  }

  // mark messages as seen
  static async markMessagesSeen(chatId, messageIds = [], seenByUid) {
    if (!Array.isArray(messageIds) || messageIds.length === 0) return;
    await db.query(
      `UPDATE messages SET status = 'seen', seen_at = NOW(), unread = 0 WHERE id IN (${messageIds.map(()=>'?').join(',')}) AND chat_id = ?`,
      [...messageIds, chatId]
    );
    // Additionally update chats table unread counters for seenByUid
    await ChatModel.resetChatUnreadForUser(chatId, seenByUid);
  }

  // reset chat unread counter for a specific user
  static async resetChatUnreadForUser(chatId, uid) {
    const [rows] = await db.query(`SELECT user1_uid, user2_uid FROM chats WHERE id = ?`, [chatId]);
    const chat = rows[0];
    if (!chat) return;
    if (chat.user1_uid === uid) {
      await db.query(`UPDATE chats SET user1_unread = 0 WHERE id = ?`, [chatId]);
    } else if (chat.user2_uid === uid) {
      await db.query(`UPDATE chats SET user2_unread = 0 WHERE id = ?`, [chatId]);
    }
  }
}

module.exports = ChatModel;
