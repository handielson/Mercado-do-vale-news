const { Client } = require('ssh2');

const remoteScript = `
  const mysql = require('mysql2/promise');
  require('dotenv').config({ path: '/var/www/mdv-api/.env' });
  
  async function main() {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });
    try {
      const slug = 'mensalidade-de-servidor-alternativo';
      console.log('\\n--- CHECANDO TABELA PRODUCTS ---');
      const [rows] = await pool.query('SELECT id, name, slug, bling_id, is_combo, is_virtual FROM products WHERE slug = ? OR name LIKE "%Servidor Alternativo%"', [slug]);
      console.table(rows);

      console.log('\\n--- CHECANDO MÚLTIPLOS PRODUTOS COMO AMOSTRA (VER BLING_ID) ---');
      const [rowsSample] = await pool.query('SELECT id, name, bling_id FROM products WHERE is_combo = 0 ORDER BY updated_at DESC LIMIT 5');
      console.table(rowsSample);

    } catch (err) {
      console.error('❌ Erro no DB da VPS:', err.message);
    } finally {
      await pool.end();
    }
  }
  main();
`;

console.log('⏳ Conectando à VPS para diagnóstico...');

const conn = new Client();
conn.on('ready', () => {
  console.log('✅ Conectado!');
  
  console.log('\\n--- CHECANDO PM2 ---');
  conn.exec(`pm2 status mdv-api && pm2 logs mdv-api --lines 20 --nostream`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      
      const base64Script = Buffer.from(remoteScript).toString('base64');
      conn.exec(`cd /var/www/mdv-api && node -e "eval(Buffer.from('${base64Script}', 'base64').toString('utf8'))"`, (err2, stream2) => {
        if (err2) throw err2;
        let out = '';
        stream2.on('close', () => {
          console.log(out);
          conn.end();
        }).on('data', data => out += data).stderr.on('data', data => console.error(data.toString()));
      });

    });
    stream.on('data', data => process.stdout.write(data.toString()));
    stream.stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
