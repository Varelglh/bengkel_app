const express = require("express");
const router = express.Router();

const saController = require("../controllers/sa.controller");
const auth = require("../middleware/auth");
const role = require("../middleware/role");

// LIST INSPECTION SA
router.get(
  "/inspection",
  auth,
  role(["sa"]),
  saController.getSaInspections
);

// DETAIL INSPECTION
router.get(
  "/inspection/:id",
  auth,
  role(["sa"]),
  saController.getSaInspectionDetail
);

// DOWNLOAD PDF
router.get(
  "/inspection/:id/pdf",
  auth,
  role(["sa"]),
  saController.downloadInspectionPdf
);

module.exports = router;