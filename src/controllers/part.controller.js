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
      part: {
        id: part.id,
        part_no: part.part_no,
        part_name: part.part_name,
        harga: part.harga,
        stock: part.stock,
        tersedia: part.stock > 0,
        icon: part.icon
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


