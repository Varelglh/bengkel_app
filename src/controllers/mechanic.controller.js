const db = require("../config/db");

/*
|--------------------------------------------------------------------------
| CREATE INSPECTION
|--------------------------------------------------------------------------
*/
exports.createInspection = async (req, res) => {
  try {
    const mekanik_id = req.user.id;
    const data = JSON.parse(req.body.data);

    const {
      nopol,
      tanggal,
      type_kendaraan,
      tahun,
      odometer,
      sa_id,
      karu_id,
      parts
    } = data;

    // ================= VALIDASI WAJIB =================
    if (!nopol || !tanggal || !type_kendaraan || !sa_id || !karu_id) {
      return res.status(400).json({
        success: false,
        message: "Data wajib tidak lengkap"
      });
    }

    // ================= VALIDASI SA (role_id = 3) =================
    const [[sa]] = await db.query(
      "SELECT id FROM users WHERE id=? AND role_id=3",
      [sa_id]
    );
    if (!sa) {
      return res.status(400).json({
        success: false,
        message: "SA tidak valid atau bukan role SA"
      });
    }

    // ================= VALIDASI KARU (role_id = 4) =================
    const [[karu]] = await db.query(
      "SELECT id FROM users WHERE id=? AND role_id=4",
      [karu_id]
    );
    if (!karu) {
      return res.status(400).json({
        success: false,
        message: "Karu tidak valid atau bukan role Karu"
      });
    }

    // ================= VALIDASI PART =================
    if (!Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Minimal 1 part harus dipilih"
      });
    }

    if (parts.length > 10) {
      return res.status(400).json({
        success: false,
        message: "Maksimal 10 jenis part"
      });
    }

    const partKeys = parts.map(p => p.part_id ? `id:${p.part_id}` : `no:${p.part_no}`);
    if (new Set(partKeys).size !== partKeys.length) {
      return res.status(400).json({
        success: false,
        message: "Part tidak boleh duplikat"
      });
    }

    // ================= CEK DUPLIKAT OPEN =================
    const [existing] = await db.query(
      "SELECT id FROM inspections WHERE nopol=? AND status='OPEN'",
      [nopol]
    );
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Masih ada inspection OPEN untuk kendaraan ini"
      });
    }

    // ================= FILE ICON =================
    const carIcon = req.files?.car_icon
      ? `/uploads/inspections/${req.files.car_icon[0].filename}`
      : null;

    // ================= INSERT INSPECTION =================
    const [inspection] = await db.query(
      `INSERT INTO inspections
      (car_icon,nopol,tanggal,type_kendaraan,tahun,odometer,mekanik_id,sa_id,karu_id,status)
      VALUES (?,?,?,?,?,?,?,?,?,'OPEN')`,
      [
        carIcon,
        nopol,
        tanggal,
        type_kendaraan,
        tahun,
        odometer,
        mekanik_id,
        sa_id,
        karu_id
      ]
    );

    const inspection_id = inspection.insertId;
    let total = 0;

    // ================= INSERT PART =================
    for (let i = 0; i < parts.length; i++) {
      const { part_id, part_no, qty } = parts[i];

      // Support lookup by part_id (dropdown) atau part_no (legacy)
      let pRows;
      if (part_id) {
        [pRows] = await db.query(
          "SELECT id, harga, stock, part_no FROM part_stock WHERE id=?",
          [part_id]
        );
      } else {
        [pRows] = await db.query(
          "SELECT id, harga, stock FROM part_stock WHERE part_no=?",
          [part_no]
        );
      }

      if (!pRows.length) {
        return res.status(404).json({
          success: false,
          message: `Part ${part_id || part_no} tidak ditemukan`
        });
      }

      if (pRows[0].stock < qty) {
        return res.status(400).json({
          success: false,
          message: `Stok part ${pRows[0].part_no || part_no} tidak cukup`
        });
      }

      const partPhoto = req.files?.part_photo?.[i]
        ? `/uploads/inspections/${req.files.part_photo[i].filename}`
        : null;

      await db.query(
        `INSERT INTO inspection_parts
        (inspection_id,photo,part_id,harga,qty,available_qty)
        VALUES (?,?,?,?,?,?)`,
        [inspection_id, partPhoto, pRows[0].id, pRows[0].harga, qty, pRows[0].stock]
      );

      await db.query(
        "UPDATE part_stock SET stock = stock - ? WHERE id=?",
        [qty, pRows[0].id]
      );

      total += Number(pRows[0].harga) * Number(qty);
    }

    // ================= UPDATE TOTAL =================
    await db.query(
      "UPDATE inspections SET total=? WHERE id=?",
      [total, inspection_id]
    );

    return res.status(201).json({
      success: true,
      message: "Inspection berhasil dibuat",
      inspection_id,
      total
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server"
    });
  }
};


/*
|--------------------------------------------------------------------------
| READ LIST INSPECTION (HANYA DATA USER LOGIN)
|--------------------------------------------------------------------------
*/
exports.getInspections = async (req, res) => {
  try {
    const mekanik_id = req.user.id;

    const [rows] = await db.query(`
      SELECT 
        i.id,
        i.car_icon,
        i.nopol,
        i.type_kendaraan,
        i.status,
        u.name AS sa_name
      FROM inspections i
      JOIN users u ON u.id = i.sa_id
      WHERE i.mekanik_id = ?
      ORDER BY i.created_at DESC
    `, [mekanik_id]);

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getInspectionDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const mekanik_id = req.user.id;

    // ================= HEADER INSPECTION =================
    const [[inspection]] = await db.query(
      `SELECT 
        i.id,
        i.nopol,
        i.type_kendaraan,
        i.tahun,
        i.odometer,
        i.tanggal,
        i.car_icon,
        i.status,
        i.total,
        i.sa_id,
        i.karu_id,
        sa.name AS sa_name,
        karu.name AS karu_name
      FROM inspections i
      JOIN users sa ON sa.id = i.sa_id
      JOIN users karu ON karu.id = i.karu_id
      WHERE i.id=? AND i.mekanik_id=?`,
      [id, mekanik_id]
    );

    if (!inspection) {
      return res.status(403).json({
        message: "Anda tidak berhak mengakses inspection ini"
      });
    }

    // ================= DETAIL TINDAKAN PERBAIKAN =================
    const [actions] = await db.query(`
      SELECT 
        p.part_no,
        p.part_name,
        ip.qty,
        ip.harga,
        ip.photo,
        (ip.qty * ip.harga) AS subtotal
      FROM inspection_parts ip
      JOIN part_stock p ON p.id = ip.part_id
      WHERE ip.inspection_id=?
    `, [id]);

    // ================= RESPONSE OPSI 3 =================
    res.json({
      success: true,
      status: inspection.status, // OPEN / DONE
      message:
        inspection.status === "OPEN"
          ? "Inspection masih dalam proses"
          : "Detail tindakan perbaikan",
      inspection: {
        id: inspection.id,
        nopol: inspection.nopol,
        type_kendaraan: inspection.type_kendaraan,
        tahun: inspection.tahun,
        odometer: inspection.odometer,
        tanggal: inspection.tanggal,
        car_icon: inspection.car_icon,
        sa_id: inspection.sa_id,
        karu_id: inspection.karu_id,
        sa_name: inspection.sa_name,
        karu_name: inspection.karu_name,
        total: inspection.total
      },
      actions
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/*
|--------------------------------------------------------------------------
| LIST USERS (SA / KARU) - untuk dropdown form mekanik
|--------------------------------------------------------------------------
*/
exports.getSaUsers = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, email FROM users WHERE role_id=3 ORDER BY name ASC"
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getKaruUsers = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, email FROM users WHERE role_id=4 ORDER BY name ASC"
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};


/*
|--------------------------------------------------------------------------
| GET DISTINCT VEHICLE TYPES dari part_stock
|--------------------------------------------------------------------------
*/
exports.getVehicleTypes = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT DISTINCT type_kendaraan FROM part_stock WHERE type_kendaraan IS NOT NULL AND type_kendaraan != '' ORDER BY type_kendaraan ASC"
    );
    const types = rows.map(r => r.type_kendaraan);
    return res.json({ success: true, data: types });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

/*
|--------------------------------------------------------------------------
| GET PARTS berdasarkan type_kendaraan
|--------------------------------------------------------------------------
*/
exports.getPartsByVehicleType = async (req, res) => {
  try {
    const { type } = req.params;
    const [rows] = await db.query(
      "SELECT id, part_no, part_name, stock, harga, icon FROM part_stock WHERE type_kendaraan = ? AND stock > 0 ORDER BY part_name ASC",
      [type]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateInspection = async (req, res) => {
  try {
    const { id } = req.params;
    const mekanik_id = req.user.id;
    const data = JSON.parse(req.body.data);

    const {
      nopol,
      tanggal,
      type_kendaraan,
      tahun,
      odometer,
      sa_id,
      karu_id,
      parts
    } = data;

    // ================= CEK KEPEMILIKAN & STATUS =================
    const [[inspection]] = await db.query(
      "SELECT id, status, car_icon FROM inspections WHERE id=? AND mekanik_id=?",
      [id, mekanik_id]
    );

    if (!inspection) {
      return res.status(403).json({ message: "Tidak punya akses" });
    }

    if (inspection.status !== "OPEN") {
      return res.status(400).json({ message: "Inspection sudah selesai, tidak bisa diedit" });
    }

    // ================= ICON BARU (JIKA ADA) =================
    let newCarIcon = inspection.car_icon;
    if (req.files?.car_icon) {
      newCarIcon = `/uploads/inspections/${req.files.car_icon[0].filename}`;
    } else if (data.delete_car_icon === true) {
      newCarIcon = null;
    }

    // ================= BALIKIN STOK PART LAMA =================
    const [oldParts] = await db.query(
      "SELECT part_id, qty FROM inspection_parts WHERE inspection_id=?",
      [id]
    );

    for (const part of oldParts) {
      await db.query(
        "UPDATE part_stock SET stock = stock + ? WHERE id=?",
        [part.qty, part.part_id]
      );
    }

    // ================= HAPUS PART LAMA =================
    await db.query(
      "DELETE FROM inspection_parts WHERE inspection_id=?",
      [id]
    );

    // ================= UPDATE INSPECTION =================
    await db.query(
      `UPDATE inspections SET
        car_icon=?,
        nopol=?,
        tanggal=?,
        type_kendaraan=?,
        tahun=?,
        odometer=?,
        sa_id=?,
        karu_id=?
       WHERE id=?`,
      [
        newCarIcon,
        nopol,
        tanggal,
        type_kendaraan,
        tahun,
        odometer,
        sa_id,
        karu_id,
        id
      ]
    );

    let total = 0;

    // ================= INSERT PART BARU =================
    for (let i = 0; i < parts.length; i++) {
      const { part_id, part_no, qty } = parts[i];

      // Support lookup by part_id (dropdown) atau part_no (legacy)
      let pRows;
      if (part_id) {
        [pRows] = await db.query(
          "SELECT id, harga, stock, part_no FROM part_stock WHERE id=?",
          [part_id]
        );
      } else {
        [pRows] = await db.query(
          "SELECT id, harga, stock FROM part_stock WHERE part_no=?",
          [part_no]
        );
      }

      if (!pRows.length) {
        return res.status(404).json({ message: `Part ${part_id || part_no} tidak ditemukan` });
      }

      if (pRows[0].stock < qty) {
        return res.status(400).json({
          message: `Stok part ${pRows[0].part_no || part_no} tidak cukup`
        });
      }

      const partPhoto = req.files?.part_photo?.[i]
        ? `/uploads/inspections/${req.files.part_photo[i].filename}`
        : null;

      await db.query(
        `INSERT INTO inspection_parts
        (inspection_id,photo,part_id,harga,qty,available_qty)
        VALUES (?,?,?,?,?,?)`,
        [id, partPhoto, pRows[0].id, pRows[0].harga, qty, pRows[0].stock]
      );

      await db.query(
        "UPDATE part_stock SET stock = stock - ? WHERE id=?",
        [qty, pRows[0].id]
      );

      total += Number(pRows[0].harga) * Number(qty);
    }

    // ================= UPDATE TOTAL =================
    await db.query(
      "UPDATE inspections SET total=? WHERE id=?",
      [total, id]
    );

    res.json({
      success: true,
      message: "Inspection berhasil diperbarui",
      total
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteInspection = async (req, res) => {
  try {
    const { id } = req.params;
    const mekanik_id = req.user.id;

    // 1️⃣ CEK DATA ADA ATAU TIDAK
    const [[inspection]] = await db.query(
      "SELECT id, status, mekanik_id FROM inspections WHERE id=?",
      [id]
    );

    if (!inspection) {
      return res.status(404).json({
        message: "Inspection tidak ditemukan"
      });
    }

    // 2️⃣ CEK KEPEMILIKAN
    if (inspection.mekanik_id !== mekanik_id) {
      return res.status(403).json({
        message: "Anda tidak punya akses ke inspection ini"
      });
    }

    // 3️⃣ CEK STATUS
    if (inspection.status !== "OPEN") {
      return res.status(400).json({
        message: "Inspection sudah selesai, tidak bisa dihapus"
      });
    }

    // 4️⃣ AMBIL PART
    const [parts] = await db.query(
      "SELECT part_id, qty FROM inspection_parts WHERE inspection_id=?",
      [id]
    );

    // 5️⃣ BALIKIN STOK
    for (const part of parts) {
      await db.query(
        "UPDATE part_stock SET stock = stock + ? WHERE id=?",
        [part.qty, part.part_id]
      );
    }

    // 6️⃣ HAPUS DATA
    await db.query("DELETE FROM inspection_parts WHERE inspection_id=?", [id]);
    await db.query("DELETE FROM inspections WHERE id=?", [id]);

    res.json({
      success: true,
      message: "Inspection berhasil dihapus"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
