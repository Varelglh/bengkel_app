const db = require("../config/db");

exports.getKaruInspections = async (req, res) => {
  try {
    const karu_id = req.user.id;

    const [rows] = await db.query(`
      SELECT 
        i.id,
        i.car_icon,
        i.nopol,
        sa.name AS sa_name,
        COALESCE(ka_summary.tindakan, 'belum_diperiksa') AS status_tindakan,
        COALESCE(ka_summary.status, 'belum_diperiksa') AS status_perbaikan
      FROM inspections i
      JOIN users sa ON sa.id = i.sa_id
      LEFT JOIN (
        SELECT ka.inspection_id, ka.tindakan, ka.status
        FROM karu_actions ka
        INNER JOIN (
          SELECT inspection_id, MAX(id) AS max_id
          FROM karu_actions
          GROUP BY inspection_id
        ) latest ON latest.inspection_id = ka.inspection_id AND latest.max_id = ka.id
      ) ka_summary ON ka_summary.inspection_id = i.id
      WHERE i.karu_id = ?
      ORDER BY i.created_at DESC
    `, [karu_id]);

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getKaruInspectionDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const karu_id = req.user.id;

    // ================= CEK ADA / TIDAK =================
    const [[inspection]] = await db.query(`
      SELECT 
        i.id,
        i.nopol,
        i.type_kendaraan,
        i.tahun,
        i.odometer,
        i.tanggal,
        i.car_icon,
        i.status,
        i.total,
        i.karu_id,
        sa.name AS sa_name,
        m.name AS mekanik_name
      FROM inspections i
      JOIN users sa ON sa.id = i.sa_id
      JOIN users m ON m.id = i.mekanik_id
      WHERE i.id=?`,
      [id]
    );

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: "Inspection tidak ditemukan"
      });
    }

    // ================= CEK KEPEMILIKAN =================
    if (inspection.karu_id !== karu_id) {
      return res.status(403).json({
        success: false,
        message: "Tidak punya akses ke inspection ini"
      });
    }

    // ================= AMBIL PART =================
    const [parts] = await db.query(`
      SELECT 
        ip.id AS inspection_part_id,
        p.part_no,
        p.part_name,
        ip.qty,
        ip.photo,
        ka.tanggal_perbaikan,
        ka.tindakan,
        ka.status
      FROM inspection_parts ip
      JOIN part_stock p ON p.id = ip.part_id
      LEFT JOIN karu_actions ka ON ka.inspection_part_id = ip.id
      WHERE ip.inspection_id=?`,
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "Detail inspection berhasil diambil",
      inspection: {
        id: inspection.id,
        nopol: inspection.nopol,
        type_kendaraan: inspection.type_kendaraan,
        tahun: inspection.tahun,
        odometer: inspection.odometer,
        tanggal: inspection.tanggal,
        car_icon: inspection.car_icon,
        status: inspection.status,
        total: inspection.total,
        sa_name: inspection.sa_name,
        mekanik_name: inspection.mekanik_name
      },
      parts
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server"
    });
  }
};


exports.saveKaruAction = async (req, res) => {
  try {
    const karu_id = req.user.id;
    const {
      inspection_id,
      inspection_part_id,
      tanggal_perbaikan,
      tindakan, // diganti / tidak_diganti
      status     // selesai / belum_selesai
    } = req.body;

    // ================= CEK KEPEMILIKAN =================
    const [[inspection]] = await db.query(
      "SELECT id FROM inspections WHERE id=? AND karu_id=?",
      [inspection_id, karu_id]
    );

    if (!inspection) {
      return res.status(403).json({ message: "Tidak punya akses" });
    }

    // ================= UPSERT KARU ACTION =================
    const [existing] = await db.query(
      "SELECT id FROM karu_actions WHERE inspection_part_id=?",
      [inspection_part_id]
    );

    if (existing.length > 0) {
      await db.query(
        `UPDATE karu_actions
         SET tanggal_perbaikan=?, tindakan=?, status=?
         WHERE inspection_part_id=?`,
        [tanggal_perbaikan, tindakan, status, inspection_part_id]
      );
    } else {
      await db.query(
        `INSERT INTO karu_actions
        (inspection_id, inspection_part_id, tanggal_perbaikan, tindakan, status)
        VALUES (?,?,?,?,?)`,
        [inspection_id, inspection_part_id, tanggal_perbaikan, tindakan, status]
      );
    }

    // ================= CEK APAKAH SEMUA PART SUDAH SELESAI =================

    // total part di inspection
    const [[totalParts]] = await db.query(
      "SELECT COUNT(*) AS total FROM inspection_parts WHERE inspection_id=?",
      [inspection_id]
    );

    // total part yang status-nya selesai
    const [[doneParts]] = await db.query(
      `SELECT COUNT(*) AS total FROM karu_actions
       WHERE inspection_id=? AND status='selesai'`,
      [inspection_id]
    );

    // ================= AUTO DONE =================
    if (totalParts.total === doneParts.total) {
      await db.query(
        "UPDATE inspections SET status='DONE' WHERE id=?",
        [inspection_id]
      );
    }

    res.json({
      success: true,
      message: "Tindakan perbaikan disimpan",
      inspection_status:
        totalParts.total === doneParts.total ? "DONE" : "OPEN"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
