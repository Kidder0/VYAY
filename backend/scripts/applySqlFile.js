const fs = require("fs");
const path = require("path");

const pool = require("../db");

async function main() {
  const relativeFile = process.argv[2];

  if (!relativeFile) {
    throw new Error("Usage: node scripts/applySqlFile.js <relative-sql-file>");
  }

  const absoluteFile = path.resolve(__dirname, "..", relativeFile);
  const sql = fs.readFileSync(absoluteFile, "utf8");

  await pool.query(sql);
  await pool.end();

  console.log(`Applied SQL file: ${absoluteFile}`);
}

main().catch(async (error) => {
  console.error("SQL apply failed:", error);
  try {
    await pool.end();
  } catch (_) {
    // ignore close errors
  }
  process.exit(1);
});
