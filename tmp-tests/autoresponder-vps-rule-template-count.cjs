const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { readLegacyVpsConst: readConst } = require('./vps-ssh-config.cjs');

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function exec(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (data) => {
        stdout += data.toString();
      });
      stream.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      stream.on('close', (code) => {
        if (code === 0) return resolve(stdout);
        reject(new Error(stderr || stdout || `Command failed: ${command}`));
      });
    });
  });
}

const remoteScript = `
require('dotenv').config();
const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 1,
  });
  try {
    const templateNames = [
      'Saudacao manha',
      'Saudacao tarde',
      'Saudacao noite',
      'Saudacao generica',
      'Despedida',
      'Endereco/localizacao',
      'Horario de funcionamento',
      'Estacionamento',
      'Entrega/frete',
      'Formas de pagamento',
      'Desconto a vista / PIX',
      'Nota fiscal',
      'Garantia',
      'Troca/devolucao',
      'Assistencia tecnica',
      'Troca de tela / pelicula',
      'Desbloqueio',
      'Aceita usado/seminovo',
      'Catalogo / produtos',
      'Promocoes/ofertas',
      'Falar com humano',
      'Fallback auto',
    ];
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS total, SUM(active = 1) AS active_count FROM autoresponder_rules WHERE name IN (?)',
      [templateNames]
    );
    const [humanRows] = await pool.query(
      'SELECT name, active, priority FROM autoresponder_rules WHERE name = ? LIMIT 1',
      ['Falar com humano']
    );
    console.log(JSON.stringify({
      ok: Number(rows[0].total) === 22 && Number(rows[0].active_count) >= 1 && Number(humanRows[0]?.active) === 1,
      total: Number(rows[0].total),
      active_count: Number(rows[0].active_count),
      human: humanRows[0] || null,
    }));
  } finally {
    await pool.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
`;

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect({
        host: readConst('VpsHost'),
        port: 22,
        username: readConst('VpsUser'),
        password: readConst('VpsPass'),
        readyTimeout: 15000,
      });
  });

  try {
    const stdout = await exec(conn, `cd /var/www/mdv-api && node -e ${shellQuote(remoteScript)}`);
    console.log(stdout.trim());
  } finally {
    conn.end();
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
