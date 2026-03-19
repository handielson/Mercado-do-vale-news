const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado!');
  conn.exec(`node -e "
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/mdv-api/.env' });
async function run() {
  try {
    const pool = mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
    const [rows] = await pool.query('SELECT COUNT(*) as total FROM products');
    console.log('PRODUCTS COUNT:', rows[0].total);
    const [rows2] = await pool.query('SELECT id, name, exclude_from_seo FROM products WHERE name LIKE \\'%cine%\\' LIMIT 5');
    console.log('CINEBOX DB:', rows2);
    process.exit(0);
  } catch(e) {
    console.error('ERROR:', e);
    process.exit(1);
  }
}
run();
  "`, { cwd: '/var/www/mdv-api' }, (e2, s2) => {
       s2.pipe(process.stdout);
       s2.stderr.pipe(process.stderr);
       s2.on('close', () => conn.end());
  });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
