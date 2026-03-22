const { Client } = require('ssh2');

const script = `
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/mdv-api/.env' });
async function run() {
  const pool = mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  try {
      console.log('Adicionando colunas de COMBO na tabela products...');
      await pool.query("ALTER TABLE products ADD COLUMN is_combo BOOLEAN DEFAULT false").catch(e=>console.log('Coluna is_combo ja existe ou erro:', e.message));
      await pool.query("ALTER TABLE products ADD COLUMN combo_discount_type VARCHAR(20) DEFAULT NULL").catch(e=>console.log('Coluna combo_discount_type ja existe ou erro:', e.message));
      await pool.query("ALTER TABLE products ADD COLUMN combo_discount_value DECIMAL(10,2) DEFAULT 0").catch(e=>console.log('Coluna combo_discount_value ja existe ou erro:', e.message));
      
      console.log('Criando tabela product_combos...');
      await pool.query("CREATE TABLE IF NOT EXISTS product_combos ( id VARCHAR(50) PRIMARY KEY, combo_product_id VARCHAR(50) NOT NULL, child_product_id VARCHAR(50) NOT NULL, quantity INT DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (combo_product_id) REFERENCES products(id) ON DELETE CASCADE, FOREIGN KEY (child_product_id) REFERENCES products(id) ON DELETE CASCADE )").catch(e=>console.log('Erro ao criar product_combos:', e.message));
      
      console.log('Tabelas e colunas verificadas com sucesso!');
  } catch (err) {
      console.error('Erro Critico:', err);
  }
  process.exit(0);
}
run();
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH conectado! Executando script de migração para Combos...');
    conn.exec('cd /var/www/mdv-api && node -e "' + script.replace(/"/g, '\\"').replace(/\n/g, ' ') + '"', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Migração concluída. Fechando conexão SSH...');
            conn.end();
            process.exit(0);
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}).connect({
    host: '76.13.232.162',
    port: 22,
    username: 'root',
    password: '@@@@Jsj2865@@@@'
});
