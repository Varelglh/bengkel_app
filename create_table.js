require("dotenv").config();
const db = require("./src/config/db");

async function createTable() {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS karu_actions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        inspection_id INT NOT NULL,
        inspection_part_id INT NOT NULL,
        tanggal_perbaikan VARCHAR(100),
        tindakan VARCHAR(50) DEFAULT 'belum_diperiksa',
        status VARCHAR(50) DEFAULT 'belum_diperiksa',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
        FOREIGN KEY (inspection_part_id) REFERENCES inspection_parts(id) ON DELETE CASCADE
      );
    `;
    await db.query(query);
    console.log("Table karu_actions created successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Failed to create table:", error);
    process.exit(1);
  }
}

createTable();
