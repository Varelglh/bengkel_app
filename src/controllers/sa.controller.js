const db = require("../config/db");
const PDFDocument = require("pdfkit");

/*
|--------------------------------------------------------------------------
| LIST INSPECTION (SA)
|--------------------------------------------------------------------------
*/
exports.getSaInspections = async (req, res) => {
  try {
    const sa_id = req.user.id;

    const [rows] = await db.query(`
      SELECT 
        i.id,
        i.car_icon,
        i.nopol,
        sa.name AS sa_name
      FROM inspections i
      JOIN users sa ON sa.id = i.sa_id
      WHERE i.sa_id = ?
      ORDER BY i.created_at DESC
    `, [sa_id]);

    return res.status(200).json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

/*
|--------------------------------------------------------------------------
| DETAIL INSPECTION (SA)
|--------------------------------------------------------------------------
*/
exports.getSaInspectionDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const sa_id = req.user.id;

    // ================= HEADER =================
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
        sa.name AS sa_name,
        m.name AS mekanik_name,
        k.name AS karu_name,
        i.total
      FROM inspections i
      JOIN users sa ON sa.id = i.sa_id
      LEFT JOIN users m ON m.id = i.mekanik_id
      LEFT JOIN users k ON k.id = i.karu_id
      WHERE i.id=? AND i.sa_id=?`,
      [id, sa_id]
    );

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: "Inspection tidak ditemukan"
      });
    }

    // ================= PART + STATUS KARU =================
    const [parts] = await db.query(`
      SELECT 
        p.part_no,
        p.part_name,
        ip.qty,
        ip.harga,
        COALESCE(ka.tindakan, 'belum_diperiksa') AS tindakan,
        COALESCE(ka.status, 'belum_diperiksa') AS status_perbaikan,
        (ip.qty * ip.harga) AS subtotal
      FROM inspection_parts ip
      JOIN part_stock p ON p.id = ip.part_id
      LEFT JOIN karu_actions ka ON ka.inspection_part_id = ip.id
      WHERE ip.inspection_id=?`,
      [id]
    );

    return res.status(200).json({
      success: true,
      inspection,
      parts
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


/*
|--------------------------------------------------------------------------
| DOWNLOAD PDF INSPECTION (SA)
|--------------------------------------------------------------------------
*/
exports.downloadInspectionPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const sa_id = req.user.id;

    // HEADER
    const [[inspection]] = await db.query(`
      SELECT 
        i.nopol,
        i.type_kendaraan,
        i.tahun,
        i.odometer,
        i.tanggal,
        i.total,
        sa.name AS sa_name,
        m.name AS mekanik_name
      FROM inspections i
      JOIN users sa ON sa.id = i.sa_id
      JOIN users m ON m.id = i.mekanik_id
      WHERE i.id=? AND i.sa_id=?`,
      [id, sa_id]
    );

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: "Inspection tidak ditemukan"
      });
    }

    // PART
    const [parts] = await db.query(`
      SELECT 
        p.part_name,
        ip.qty,
        ip.harga,
        (ip.qty * ip.harga) AS subtotal
      FROM inspection_parts ip
      JOIN part_stock p ON p.id = ip.part_id
      WHERE ip.inspection_id=?`,
      [id]
    );

    // ================= GENERATE PDF =================
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=inspection-${inspection.nopol}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(16).text("LAPORAN INSPECTION", { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text(`No Polisi   : ${inspection.nopol}`);
    doc.text(`Kendaraan   : ${inspection.type_kendaraan} (${inspection.tahun})`);
    doc.text(`Odometer    : ${inspection.odometer}`);
    doc.text(`Tanggal     : ${inspection.tanggal}`);
    doc.text(`SA           : ${inspection.sa_name}`);
    doc.text(`Mekanik     : ${inspection.mekanik_name}`);
    doc.moveDown();

    doc.text("Detail Part:");
    doc.moveDown(0.5);

    let total = 0;
    parts.forEach((p, i) => {
      doc.text(`${i + 1}. ${p.part_name} - ${p.qty} x ${p.harga} = ${p.subtotal}`);
      total += Number(p.subtotal);
    });

    doc.moveDown();
    doc.fontSize(12).text(`TOTAL: Rp ${total}`, { align: "right" });

    doc.end();

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
