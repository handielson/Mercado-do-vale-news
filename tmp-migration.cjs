const { Client } = require('ssh2');

const script = `
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/mdv-api/.env' });
async function run() {
  const pool = mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  try {
      console.log('Adicionando colunas na VPS MySQL...');
      await pool.query('ALTER TABLE shipping_settings ADD COLUMN enable_progressive_shipping_subsidy BOOLEAN DEFAULT false').catch(e=>console.log('Ja existe (ou erro) 1'));
      await pool.query('ALTER TABLE shipping_settings ADD COLUMN min_order_value_for_subsidy DECIMAL(10,2) DEFAULT 0').catch(e=>console.log('Ja existe 2'));
      await pool.query('ALTER TABLE shipping_settings ADD COLUMN default_subsidy_discount_percent DECIMAL(5,2) DEFAULT 100').catch(e=>console.log('Ja existe 3'));
      await pool.query('ALTER TABLE shipping_settings ADD COLUMN profit_margin_percentage_cap DECIMAL(5,2) DEFAULT 20').catch(e=>console.log('Ja existe 4'));
      
      const [rows] = await pool.query('SHOW COLUMNS FROM shipping_settings');
      console.log('Colunas atuais em shipping_settings:', rows.map(r=>r.Field).join(', '));
  } catch (err) {
      console.error(err);
  }
  process.exit(0);
}
run();
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH conectado!');
    conn.exec('cd /var/www/mdv-api && node -e "' + script.replace(/"/g, '\\"').replace(/\n/g, ' ') + '"', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Fechando conexao SSH...');
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
