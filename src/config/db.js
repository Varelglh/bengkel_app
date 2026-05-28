const mysql = require("mysql2/promise");

function requireEnv(name) {
  const value = process.env[name];
  if (!value || String(value).trim() === "") {
    throw new Error(
      `Missing environment variable ${name}. Create BE_Bengkel-main/.env and set DB_HOST, DB_USER, DB_PASS, DB_NAME.`
    );
  }
  return value;
}

const db = mysql.createPool({
  host: requireEnv("DB_HOST"),
  user: requireEnv("DB_USER"),
  password: process.env.DB_PASS ?? "",
  database: requireEnv("DB_NAME"),
});

module.exports = db;
