const express = require("express");
const router = express.Router();

const mechanicController = require("../controllers/mechanic.controller");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const upload = require("../config/uploadInspection");


router.post(
  "/inspection",
  auth,
  role(["mekanik"]),
  upload.fields([
    { name: "car_icon", maxCount: 1 },
    { name: "part_photo", maxCount: 10 }
  ]),
  mechanicController.createInspection
);

// helper endpoints untuk kebutuhan form mekanik
router.get(
  "/users/sa",
  auth,
  role(["mekanik"]),
  mechanicController.getSaUsers
);

router.get(
  "/users/karu",
  auth,
  role(["mekanik"]),
  mechanicController.getKaruUsers
);

// dropdown tipe kendaraan dari part_stock
router.get(
  "/vehicle-types",
  auth,
  role(["mekanik"]),
  mechanicController.getVehicleTypes
);

// parts berdasarkan tipe kendaraan
router.get(
  "/parts-by-type/:type",
  auth,
  role(["mekanik"]),
  mechanicController.getPartsByVehicleType
);

router.get(
  "/inspection",
  auth,
  mechanicController.getInspections
);


router.get(
  "/inspection/:id",
  auth,
  mechanicController.getInspectionDetail
);

router.put(
  "/inspection/:id",
  auth,
  role(["mekanik"]),
  upload.fields([
    { name: "car_icon", maxCount: 1 },
    { name: "part_photo", maxCount: 10 }
  ]),
  mechanicController.updateInspection
);

router.delete(
  "/inspection/:id",
  auth,
  role(["mekanik"]),
  mechanicController.deleteInspection
);

module.exports = router;
