require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  console.log('⏳ Conectando à VPS para adicionar a coluna "is_virtual"...');

  const pool = mysql.createPool({
    host: process.env.VITE_DB_HOST || process.env.DB_HOST,
    user: process.env.VITE_DB_USER || process.env.DB_USER,
    password: process.env.VITE_DB_PASS || process.env.DB_PASS,
    database: process.env.VITE_DB_NAME || process.env.DB_NAME,
  });

  try {
    // Para contornar erros se a coluna já existir em mariadb antigos
    const [cols] = await pool.query(`SHOW COLUMNS FROM products LIKE 'is_virtual'`);
    
    if (cols.length === 0) {
      await pool.query('ALTER TABLE products ADD COLUMN is_virtual BOOLEAN DEFAULT FALSE');
      console.log('✅ Sucesso: Coluna "is_virtual" adicionada à tabela "products"!');
    } else {
      console.log('✅ Tudo Certo: A coluna "is_virtual" já existe na tabela!');
    }
  } catch (error) {
    console.error('❌ Erro de banco de dados:', error.message);
  } finally {
    await pool.end();
  }
}

main();
