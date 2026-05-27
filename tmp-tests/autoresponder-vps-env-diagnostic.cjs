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
      stream.on('close', (code) => resolve({ code, stdout, stderr }));
      stream.on('data', (data) => {
        stdout += data.toString();
      });
      stream.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    });
  });
}

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

  const command = `cd /var/www/mdv-api && node - <<'NODE'
const fs = require('fs');
const envPath = '/var/www/mdv-api/.env';
const keys = ['DB_HOST','DB_USER','DB_PASS','DB_NAME','MYSQL_HOST','MYSQL_USER','MYSQL_PASSWORD','MYSQL_DATABASE','AUTORESPONDER_TOKEN','SYNC_SECRET','PORT'];
const text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const present = Object.fromEntries(keys.map((key) => [key, new RegExp('^' + key + '=', 'm').test(text)]));
console.log(JSON.stringify({ env_exists: fs.existsSync(envPath), present }, null, 2));
NODE`;
  const result = await exec(conn, command);
  conn.end();
  if (result.code !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.code || 1);
  }
  console.log(result.stdout);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
