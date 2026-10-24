const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../config/db');

async function checkTables() {
  try {
    const res = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    console.log("All tables in DB:", res.rows.map(r => r.table_name));
    process.exit(0);
  } catch (err) {
    console.error("Error querying tables:", err);
    process.exit(1);
  }
}

checkTables();
