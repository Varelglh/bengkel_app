const express = require("express");
const router = express.Router();

const partController = require("../controllers/part.controller");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const upload = require("../config/upload");

// CRUD Part (khusus role PART)
router.post("/", auth, role(["part"]), upload.single("icon"), partController.createPart);
router.get("/", auth, role(["part"]), partController.getAllParts);
router.put("/:id", auth, role(["part"]), upload.single("icon"), partController.updatePart);
router.delete("/:id", auth, role(["part"]), partController.deletePart);

// 🔥 Dipakai FE & Mekanik untuk cek stok by nomor part
router.get("/by-no/:part_no", auth, role(["mekanik","part","sa","karu"]), partController.getPartByNo);

// Tambahan: Ambil list unik type_kendaraan dari tabel part_stock
router.get("/types", auth, role(["part"]), partController.getDistinctVehicleTypes);

module.exports = router;
