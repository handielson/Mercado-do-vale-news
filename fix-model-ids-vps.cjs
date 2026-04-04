require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function fixModelIds() {
  console.log('Conectando ao banco de dados da VPS...');
  
  const pool = mysql.createPool({
    host: process.env.VITE_VPS_DB_HOST || '195.35.42.186', // IP do seu painel Hestia
    user: process.env.VITE_VPS_DB_USER || 'admin_sys',
    password: process.env.VITE_VPS_DB_PASSWORD,
    database: process.env.VITE_VPS_DB_NAME || 'admin_mercado',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    const skus = ['MM-T112', 'MCCTS', 'MQ-7304'];
    
    // Atualiza os SKUs que estavam dividindo o mesmo modelo (model_id) para deixá-los sem um modelo forçado.
    // Assim o seu sistema agrupa eles pela Marca + Nome separadamente em vez de juntá-los num card só.
    const [result] = await pool.query(
      `UPDATE products 
       SET model_id = NULL 
       WHERE sku IN (?, ?, ?)`,
      skus
    );

    console.log(`\n✅ Sucesso! Foi feito o desmembramento das máquinas.`);
    console.log(`Produtos alterados no banco de dados da VPS: ${result.affectedRows}`);
    console.log(`\nAgora ao olhar a loja, cada uma das máquinas vai aparecer no seu próprio card!`);
    
  } catch (error) {
    console.error('Erro ao atualizar os produtos:', error.message);
  } finally {
    await pool.end();
  }
}

fixModelIds();
