const db = require("../config/db");

exports.createPart = async (req, res) => {
  try {
    console.log('BODY:', req.body);      
    console.log('FILE:', req.file);
    const { part_no, part_name, stock, harga, type_kendaraan } = req.body;
    const icon = req.file ? `/uploads/parts/${req.file.filename}` : null;

    const [exist] = await db.query(
      "SELECT id FROM part_stock WHERE part_no = ?",
      [part_no]
    );

    if (exist.length > 0) {
      return res.status(400).json({ message: "Part number sudah ada" });
    }

    await db.query(
      "INSERT INTO part_stock (part_no, part_name, icon, stock, harga, type_kendaraan) VALUES (?, ?, ?, ?, ?, ?)",
      [part_no, part_name, icon, stock, harga, type_kendaraan]
    );

    res.json({ success: true, message: "Part berhasil ditambahkan" });
  } catch (err) {
    console.error('CREATE ERROR:', err);
    res.status(500).json({ message: err.message });
  }
};

exports.getAllParts = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM part_stock");

    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Belum ada data part",
        data: []
      });
    }

    res.json({
      success: true,
      message: "Data part berhasil diambil",
      data: rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data part"
    });
  }
};


exports.updatePart = async (req, res) => {
  try {
    const { id } = req.params;
    const { part_no, part_name, stock, harga, type_kendaraan } = req.body;

    const icon = req.file
      ? `/uploads/parts/${req.file.filename}`
      : req.body.icon;

    // Validasi basic
    if (!part_no || !part_name || stock == null || harga == null) {
      return res.status(400).json({
        success: false,
        message: "Semua field wajib diisi"
      });
    }

    // Cek apakah part ada
    const [rows] = await db.query(
      "SELECT id FROM part_stock WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Part tidak ditemukan"
      });
    }

    // Update data
    await db.query(
      "UPDATE part_stock SET part_no=?, part_name=?, icon=?, stock=?, harga=?, type_kendaraan=? WHERE id=?",
      [part_no, part_name, icon, stock, harga, type_kendaraan, id]
    );

    res.json({
      success: true,
      message: "Part berhasil diupdate"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Gagal mengupdate part"
    });
  }
};


exports.deletePart = async (req, res) => {
  try {
    const { id } = req.params;

    // Cek apakah data ada
    const [rows] = await db.query(
      "SELECT id FROM part_stock WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Part tidak ditemukan"
      });
    }

    // Hapus
    await db.query(
      "DELETE FROM part_stock WHERE id = ?",
      [id]
    );

    res.json({
      success: true,
      message: "Part berhasil dihapus"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Gagal menghapus part"
    });
  }
};

exports.getDistinctVehicleTypes = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT DISTINCT type_kendaraan FROM part_stock WHERE type_kendaraan IS NOT NULL AND type_kendaraan != ''"
    );
    const types = rows.map(r => r.type_kendaraan);
    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil tipe kendaraan"
    });
  }
};

exports.getPartByNo = async (req, res) => {
  try {
    const { part_no } = req.params;

    const [rows] = await db.query(
      "SELECT id, part_no, part_name, stock, harga, icon FROM part_stock WHERE part_no=?",
      [part_no]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Part tidak ditemukan"
      });
    }

    const part = rows[0];

    res.json({
      success: true,
      data: part
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

exports.getPartInspections = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        i.*, 
        u.name as mekanik_name
      FROM inspections i
      JOIN users u ON i.mekanik_id = u.id
      WHERE i.status = 'OPEN'
      ORDER BY i.created_at DESC
    `);

    for(let row of rows) {
      const [parts] = await db.query(`
        SELECT ip.*, ps.part_no, ps.part_name
        FROM inspection_parts ip
        JOIN part_stock ps ON ip.part_id = ps.id
        WHERE ip.inspection_id = ?
      `, [row.id]);
      row.parts = parts;
    }

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.validatePart = async (req, res) => {
  try {
    const { inspection_id, part_id, status } = req.body; // status: 'APPROVED' or 'REJECTED'
    
    // Update status di inspection_parts
    await db.query(
      "UPDATE inspection_parts SET validation_status = ? WHERE inspection_id = ? AND part_id = ?",
      [status, inspection_id, part_id]
    );

    // 🔥 Socket Notification
    const [inspRows] = await db.query("SELECT nopol, sa_id, mekanik_id, karu_id FROM inspections WHERE id = ?", [inspection_id]);
    if (inspRows.length > 0) {
      const io = req.app.get("io");
      if (io) {
        const payload = {
          message: `Update pengajuan part untuk ${inspRows[0].nopol}: ${status}`,
          nopol: inspRows[0].nopol,
          status: status
        };

        // Kirim ke semua yang berkepentingan
        io.to("sa").emit("part_validated", payload);
        io.to("karu").emit("part_validated", payload);
        io.to("mekanik").emit("part_validated", payload);
      }
    }

    res.json({ success: true, message: `Part berhasil di-${status.toLowerCase()}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};


