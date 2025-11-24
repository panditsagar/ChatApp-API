const db = require("../config/db");

class UserModel {
  static async findByUID(uid) {
    const [rows] = await db.query(
      "SELECT * FROM users WHERE firebase_uid = ?",
      [uid]
    );
    return rows[0];
  }

  static async create(uid, name, email, avatar) {
    const [result] = await db.query(
      "INSERT INTO users (firebase_uid, name, email, avatar, role) VALUES (?,?,?,?,?)",
      [uid, name, email, avatar, "user"]
    );
    return { id: result.insertId, uid, name, email, avatar };
  }
  static async updateProfile(uid, data) {
    const fields = [];
    const values = [];

    for (let key in data) {
      let value = data[key];

      // Convert empty strings → NULL
      if (value === "") value = null;

      fields.push(`${key} = ?`);
      values.push(value);
    }

    values.push(uid);

    await db.query(
      `UPDATE users SET ${fields.join(", ")} WHERE firebase_uid = ?`,
      values
    );

    const [rows] = await db.query(
      "SELECT * FROM users WHERE firebase_uid = ?",
      [uid]
    );

    return rows[0];
  }

  static async getAllExcept(uid) {
  const [rows] = await db.query(
    "SELECT id, firebase_uid, name, email, avatar FROM users WHERE firebase_uid != ?",
    [uid]
  );
  return rows;
}

}

module.exports = UserModel;
