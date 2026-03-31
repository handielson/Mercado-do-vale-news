const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const pool = mysql.createPool({
    host: process.env.VITE_VPS_HOST || '76.13.232.162',
    user: process.env.VITE_VPS_DB_USER || 'mdv_new',
    password: process.env.VITE_VPS_DB_PASSWORD || 'Mdv@2025!',
    database: process.env.VITE_VPS_DB_NAME || 'mdv_new'
  });

  const [rows] = await pool.query("SELECT sku, specs FROM products WHERE specs IS NOT NULL AND JSON_LENGTH(specs) > 0 LIMIT 10");
  
  if (rows.length === 0) {
    console.log("⚠️ Nenhuma spec encontrada na VPS!");
  } else {
    console.log("🛠️ Exemplo de Specs sincronizadas (Top 10):");
    rows.forEach(r => console.log(`\nSKU: ${r.sku}\nSpecs: ${JSON.stringify(r.specs, null, 2)}`));
  }
  process.exit(0);
}
run().catch(console.error);
