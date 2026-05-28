const multer = require("multer");
const path = require("path");
const fs = require("fs");

const dir = "uploads/inspections";
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.fieldname + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image")) {
    return cb(new Error("File harus gambar"));
  }
  cb(null, true);
};

module.exports = multer({ storage, fileFilter });
