import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const conn = await mysql.createConnection({
  host: process.env.VPS_DB_HOST,
  user: process.env.VPS_DB_USER,
  password: process.env.VPS_DB_PASSWORD,
  database: process.env.VPS_DB_NAME,
});

console.log('\n═══════════════════════════════════════');
console.log('🔎 PRODUTO A13A04SRC (VÍDEO INCORRETO)');
console.log('═══════════════════════════════════════\n');

const [video] = await conn.execute(
  `SELECT id, sku, name, status, video_url FROM products WHERE sku LIKE '%A13A04SRC%' LIMIT 1`
);
console.log('Resultado:', JSON.stringify(video, null, 2));

console.log('\n═══════════════════════════════════════');
console.log('🔎 PRODUTO A-607 (ESTOQUE INCONSISTENTE)');
console.log('═══════════════════════════════════════\n');

const [stock] = await conn.execute(
  `SELECT id, sku, name, status, stock_quantity, bling_id FROM products WHERE sku LIKE '%A-607%' OR sku LIKE '%A607%' LIMIT 5`
);
console.log('Resultado:', JSON.stringify(stock, null, 2));

console.log('\n═══════════════════════════════════════');
console.log('📊 PRODUTOS BLING COM ESTOQUE, MAS INATIVOS');
console.log('═══════════════════════════════════════\n');

const [inactive] = await conn.execute(`
  SELECT id, sku, name, status, stock_quantity, bling_id 
  FROM products 
  WHERE status = 'I' AND bling_id IS NOT NULL AND stock_quantity > 0 
  LIMIT 10
`);
console.log(`Encontrados ${inactive.length} produtos:`);
console.log(JSON.stringify(inactive, null, 2));

await conn.end();
