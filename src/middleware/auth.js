const jwt = require("jsonwebtoken");
const blacklist = require("../utils/tokenBlacklist");

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token;

    if (authHeader) {
      token = authHeader.split(" ")[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: "Token tidak ada" });
    }

    // check blacklist
    if (blacklist.has(token)) {
      return res.status(401).json({ message: "Token tidak valid (logged out)" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded; // { id, role }

    next();
  } catch (err) {
    return res.status(401).json({ message: "Token tidak valid" });
  }
};
