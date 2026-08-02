const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
for (const root of [path.join(__dirname, '..'), path.join(__dirname, '..', '..', '..', 'mercado-do-vale')]) {
  require('dotenv').config({ path: path.join(root, '.env.vps.local'), quiet: true });
  require('dotenv').config({ path: path.join(root, '.env.local'), quiet: true });
}
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const LOCAL_PORT = Number(process.env.GOOGLE_CONTACTS_OAUTH_PORT || 8766);
const AUTH_URL_OUTPUT = String(process.env.GOOGLE_CONTACTS_AUTH_URL_OUTPUT || '').trim();
function run(conn, command, pipeOutput = false) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = ''; let stderr = '';
    stream.on('data', (chunk) => {
      stdout += chunk;
      if (AUTH_URL_OUTPUT) {
        const match = stdout.match(/AUTH_URL=(https:\/\/[^\r\n]+)/);
        if (match) fs.writeFileSync(AUTH_URL_OUTPUT, match[1], 'utf8');
      }
      if (pipeOutput) process.stdout.write(chunk);
    });
    stream.stderr.on('data', (chunk) => { stderr += chunk; if (pipeOutput) process.stderr.write(chunk); });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
  }));
}
function upload(conn, local, remote) {
  return new Promise((resolve, reject) => conn.sftp((error, sftp) => {
    if (error) return reject(error);
    sftp.fastPut(local, remote, (uploadError) => { sftp.end(); uploadError ? reject(uploadError) : resolve(); });
  }));
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  console.log('SSH conectado; preparando autorizacao remota.');
  const localServer = net.createServer((socket) => {
    conn.forwardOut('127.0.0.1', socket.remotePort || 0, '127.0.0.1', LOCAL_PORT, (error, stream) => {
      if (error) return socket.destroy();
      socket.pipe(stream).pipe(socket);
    });
  });
  try {
    const pm2 = JSON.parse(await run(conn, 'pm2 jlist'));
    const api = pm2.find((item) => String(item.name || '').includes('mdv-api') || String(item.pm2_env?.pm_exec_path || '').includes('vps_server'));
    if (!api?.pm2_env?.pm_cwd) throw new Error('mdv-api not found');
    const remoteScript = '/tmp/mdv-google-contacts-oauth-vps.cjs';
    await upload(conn, path.join(__dirname, '..', 'tools', 'google-contacts-oauth-vps.cjs'), remoteScript);
    console.log('Utilitario temporario enviado para a VPS.');
    await new Promise((resolve, reject) => localServer.once('error', reject).listen(LOCAL_PORT, '127.0.0.1', resolve));
    console.log(`Tunel local ativo em http://127.0.0.1:${LOCAL_PORT}.`);
    await run(conn, `cd ${api.pm2_env.pm_cwd} && GOOGLE_CONTACTS_OAUTH_PORT=${LOCAL_PORT} node ${remoteScript}`, true);
    await run(conn, `rm -f ${remoteScript} && pm2 restart ${api.name} --update-env >/dev/null`);
    console.log('Google Contacts OAuth installed on VPS and mdv-api restarted.');
  } finally {
    localServer.close();
    conn.end();
  }
}

main().catch((error) => { console.error(error.message); process.exit(1); });
