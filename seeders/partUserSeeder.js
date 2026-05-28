require("dotenv").config();
const db = require("../src/config/db");
const bcrypt = require("bcrypt");

async function seedPartUser() {
  try {
    // cek apakah user part sudah ada
    const [users] = await db.query(
      "SELECT id FROM users WHERE email = 'part@bengkel.com'"
    );

    if (users.length > 0) {
      console.log("User PART sudah ada.");
      process.exit();
    }

    // ambil role_id dari role name = 'part'
    const [roles] = await db.query(
      "SELECT id FROM roles WHERE name = 'part'"
    );

    if (!roles.length) {
      console.log("Role 'part' belum ada. Jalankan roles seeder dulu.");
      process.exit(1);
    }

    const role_id = roles[0].id;
    const password = await bcrypt.hash("123456", 10);

    await db.query(
      "INSERT INTO users (name,email,password,role_id) VALUES (?,?,?,?)",
      ["Bagian Part", "part@bengkel.com", password, role_id]
    );

    console.log("User PART berhasil dibuat.");
    process.exit();
  } catch (err) {
    console.error("Seeder error:", err);
    process.exit(1);
  }
}

seedPartUser();
