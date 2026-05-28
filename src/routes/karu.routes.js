const express = require("express");
const router = express.Router();

const karuController = require("../controllers/karu.controller");
const auth = require("../middleware/auth");
const role = require("../middleware/role");

// LIST INSPECTION UNTUK KARU
router.get(
  "/inspection",
  auth,
  role(["karu"]),
  karuController.getKaruInspections
);

// DETAIL INSPECTION
router.get(
  "/inspection/:id",
  auth,
  role(["karu"]),
  karuController.getKaruInspectionDetail
);

// SIMPAN TINDAKAN KARU
router.post(
  "/action",
  auth,
  role(["karu"]),
  karuController.saveKaruAction
);

module.exports = router;
