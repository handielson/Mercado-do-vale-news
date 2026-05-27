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
        resolve({ code, stdout, stderr, command });
      });
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
  const timeout = setTimeout(() => {
    conn.end();
    console.log(JSON.stringify({ ok: false, timed_out: true }, null, 2));
    process.exit(2);
  }, 20000);

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

  const pm2 = await exec(conn, 'pm2 jlist');
  let appDir = '/var/www/mdv-api';
  let appName = '';
  try {
    const list = JSON.parse(pm2.stdout || '[]');
    const apiProc = list.find((p) =>
      String(p?.pm2_env?.pm_exec_path || '').includes('server') ||
      String(p?.name || '').includes('api') ||
      String(p?.name || '').includes('vps')
    );
    if (apiProc) {
      appDir = apiProc.pm2_env.pm_cwd || appDir;
      appName = apiProc.name || '';
    }
  } catch {}

  const checks = [];
  checks.push(await exec(conn, `test -f ${appDir}/server.js && echo server_js_exists || echo server_js_missing`));
  checks.push(await exec(conn, `grep -n "autoresponder-webhook" ${appDir}/server.js ${appDir}/vps_server.js 2>/dev/null || true`));
  checks.push(await exec(conn, `cd ${appDir} && node --check server.js`));
  checks.push(await exec(conn, `pm2 describe ${appName || 'mdv-api'} | sed -n '1,80p'`));

  conn.end();
  clearTimeout(timeout);

  console.log(JSON.stringify({
    ok: true,
    appDir,
    appName,
    pm2_code: pm2.code,
    checks: checks.map((item) => ({
      command: item.command,
      code: item.code,
      stdout: item.stdout.slice(0, 4000),
      stderr: item.stderr.slice(0, 2000),
    })),
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
