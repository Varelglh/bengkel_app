require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// STATIC FILES
app.use("/uploads", express.static("uploads"));

// ROUTES
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/part-stock", require("./routes/part.routes"));
app.use("/api/mechanic", require("./routes/mechanic.routes"));
app.use("/api/karu", require("./routes/karu.routes"));
app.use("/api/sa", require("./routes/sa.routes"));



// TEST
app.get("/", (req, res) => {
  res.json({ message: "API berjalan 🚀" });
});

// ERROR HANDLER
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

module.exports = app;
