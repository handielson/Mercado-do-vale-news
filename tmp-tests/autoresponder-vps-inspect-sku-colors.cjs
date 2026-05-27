const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { readLegacyVpsConst: readConst } = require('./vps-ssh-config.cjs');

function exec(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code === 0) return resolve(stdout);
        reject(new Error(stderr || stdout || `Command failed: ${command}`));
      });
      stream.on('data', (data) => { stdout += data.toString(); });
      stream.stderr.on('data', (data) => { stderr += data.toString(); });
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: readConst('VpsHost'),
      port: 22,
      username: readConst('VpsUser'),
      password: readConst('VpsPass'),
      readyTimeout: 15000,
    });
  });
  const code = `
    require('dotenv').config({ path: '/var/www/mdv-api/.env', quiet: true });
    const mysql = require('mysql2/promise');
    (async () => {
      const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
      });
      const [rows] = await pool.query(
        "SELECT id, name, sku, model_id, price_retail, price_promo, specs, custom_fields, stock_quantity FROM products WHERE model_id = (SELECT model_id FROM products WHERE sku = 'CSRN144GRO' LIMIT 1) ORDER BY sku LIMIT 30"
      );
      await pool.end();
      console.log(JSON.stringify(rows, null, 2));
    })().catch((err) => { console.error(err); process.exit(1); });
  `;
  const encoded = Buffer.from(code, 'utf8').toString('base64');
  const output = await exec(conn, `cd /var/www/mdv-api && node -e "eval(Buffer.from('${encoded}','base64').toString('utf8'))"`);
  conn.end();
  console.log(output);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
