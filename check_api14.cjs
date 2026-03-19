const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado!');
  conn.exec(`cat /var/www/mdv-api/.env`, (e, s) => {
       let outError = '';
       s.on('data', d=>outError+=d).on('close', () => {
           console.log("APP ENV:\\n", outError);
           conn.exec(`node -e "
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/mdv-api/.env' });
async function run() {
  const pool = mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const [rows] = await pool.query('SELECT COUNT(*) as total FROM products');
  console.log('PRODUCTS COUNT:', rows[0].total);
  const [rows2] = await pool.query('SELECT * FROM products WHERE name LIKE \\'%cine%\\' LIMIT 5');
  console.log('CINEBOX:', rows2);
  process.exit(0);
}
run();
           "`, { cwd: '/var/www/mdv-api' }, (e2, s2) => {
               s2.pipe(process.stdout);
               s2.on('close', () => conn.end());
           });
       })
   });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
