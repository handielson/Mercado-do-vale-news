require('dotenv').config();
const mysql = require('mysql2/promise');

async function check() {
  const pool = mysql.createPool({
    host: process.env.VPS_DB_HOST,
    user: process.env.VPS_DB_USER,
    password: process.env.VPS_DB_PASSWORD,
    database: process.env.VPS_DB_NAME
  });

  try {
    const slug = 'mensalidade-de-servidor-alternativo';
    console.log(`Buscando produto pelo slug: ${slug}...`);
    const [rows] = await pool.query('SELECT id, name, slug, bling_id, is_combo, is_virtual FROM products WHERE slug = ? OR name LIKE "%Servidor Alternativo%"', [slug]);
    console.log('--- ENCONTRADO ---');
    console.table(rows);

    const [rowsCombos] = await pool.query('SELECT * FROM product_combos WHERE combo_product_id = ?', [rows[0]?.id]);
    console.log('--- ITENS DO COMBO ---');
    console.table(rowsCombos);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    pool.end();
  }
}

check();
