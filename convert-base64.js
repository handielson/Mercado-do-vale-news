const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/mdv-api/.env' });

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const API_BASE = process.env.API_BASE_URL || 'https://api.xiaomipetrolina.com.br';

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'mdv_new',
    password: process.env.DB_PASS || process.env.DB_PASSWORD || 'Mdv@2025!',
    database: process.env.DB_NAME || 'mdv_new'
  });

  console.log('Buscando produtos...');
  const [rows] = await pool.query("SELECT id, sku, images FROM products WHERE images LIKE '%data:image%'");
  console.log('Encontrados', rows.length, 'produtos com imagens base64.');

  let converted = 0;

  for (const row of rows) {
    if (!row.sku) continue;
    let images;
    try {
      images = typeof row.images === 'string' ? JSON.parse(row.images) : row.images;
    } catch (e) { continue; }
    
    if (!Array.isArray(images)) continue;

    const newImages = [];
    let changed = false;

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (typeof img === 'string' && img.startsWith('data:image')) {
        const matches = img.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (!matches) {
          newImages.push(img);
          continue;
        }

        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        const relPath = `products/${row.sku}/${row.sku}_${i.toString().padStart(2, '0')}.${ext}`;
        const dest = path.join(UPLOADS_DIR, relPath);
        
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buffer);

        const newUrl = `${API_BASE}/images/${relPath}`;
        newImages.push(newUrl);
        changed = true;
      } else {
        newImages.push(img);
      }
    }

    if (changed) {
      await pool.query('UPDATE products SET images = ? WHERE id = ?', [JSON.stringify(newImages), row.id]);
      console.log(`Convertido SKU: ${row.sku}`);
      converted++;
    }
  }

  console.log('Finalizado. Total convertido:', converted);
  process.exit(0);
}

run().catch(console.error);
