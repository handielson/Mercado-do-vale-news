const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const pool = mysql.createPool({
    host: process.env.VITE_VPS_HOST || '76.13.232.162',
    user: process.env.VITE_VPS_DB_USER || 'mdv_new',
    password: process.env.VITE_VPS_DB_PASSWORD || 'Mdv@2025!',
    database: process.env.VITE_VPS_DB_NAME || 'mdv_new'
  });

  const [rows] = await pool.query("SHOW COLUMNS FROM products");
  console.log("Colunas na VPS:");
  rows.forEach(r => console.log(`- ${r.Field} (${r.Type})`));
  process.exit(0);
}
run().catch(console.error);
