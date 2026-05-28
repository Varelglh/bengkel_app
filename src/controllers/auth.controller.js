const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }

    // Role PART tidak boleh register
    if (role === "part") {
      return res.status(403).json({
        message: "Role PART tidak bisa register. Gunakan akun dari admin."
      });
    }

    // Ambil role_id dari nama role
    const [roles] = await db.query(
      "SELECT id FROM roles WHERE name = ?",
      [role]
    );

    if (!roles.length) {
      return res.status(400).json({ message: "Role tidak valid" });
    }

    // Cek email
    const [exist] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (exist.length > 0) {
      return res.status(400).json({ message: "Email sudah terdaftar" });
    }

    const hashed = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO users (name,email,password,role_id) VALUES (?,?,?,?)",
      [name, email, hashed, roles[0].id]
    );

    res.json({
      success: true,
      message: "Register berhasil",
      name,
      role
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await db.query(
      `SELECT u.id, u.name, u.email, u.password, r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      [email]
    );

    if (!users.length) {
      return res.status(401).json({ message: "Email tidak ditemukan" });
    }

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({ message: "Password salah" });
    }

    // ⬇️ SIMPAN ROLE STRING KE JWT
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      success: true,
      token,
      name: user.name,
      role: user.role
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login error" });
  }
};
