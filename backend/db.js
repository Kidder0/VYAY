const { Pool } = require('pg');
require('dotenv').config();

function isLocalHost(hostname) {
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(String(hostname || ""));
}

function buildSslConfig() {
  if (process.env.DB_SSL === "false") {
    return false;
  }

  if (process.env.DB_SSL === "true") {
    return { rejectUnauthorized: false };
  }

  if (process.env.DATABASE_URL) {
    return { rejectUnauthorized: false };
  }

  if (isLocalHost(process.env.DB_HOST)) {
    return false;
  }

  return { rejectUnauthorized: false };
}

const baseConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
    }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    };

const pool = new Pool({
  ...baseConfig,
  ssl: buildSslConfig(),
});

module.exports = pool;
