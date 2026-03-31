const { Client } = require('ssh2');

const conn = new Client();

console.log('⏳ Conectando à VPS para listar as colunas de "products"...');

conn.on('ready', () => {
  const remoteScript = `
    const mysql = require('mysql2/promise');
    require('dotenv').config({ path: '/var/www/mdv-api/.env' });
    
    async function main() {
      const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
      });
      try {
        const [cols] = await pool.query("SHOW COLUMNS FROM products");
        console.log("Colunas da VPS:");
        cols.forEach(c => console.log('- ' + c.Field));
      } catch (err) {
        console.error('❌ Erro no DB da VPS:', err.message);
      } finally {
        await pool.end();
      }
    }
    main();
  `;

  const base64Script = Buffer.from(remoteScript).toString('base64');
  conn.exec(`cd /var/www/mdv-api && node -e "eval(Buffer.from('${base64Script}', 'base64').toString('utf8'))"`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code, signal) => {
      console.log(out);
      conn.end();
    }).on('data', (data) => {
      out += data;
    }).stderr.on('data', (data) => {
      console.error(data.toString());
    });
  });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
