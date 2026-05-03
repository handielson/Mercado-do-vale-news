/**
 * vps_exec.cjs
 * Roda um comando arbitrario na VPS via SSH (sem precisar do cliente ssh nativo).
 * Uso (PowerShell):
 *   $env:VPS_ROOT_PASSWORD="<senha>"
 *   node vps_exec.cjs "pm2 logs mdv-api --lines 100 --nostream"
 */
const { Client } = require('ssh2');

const HOST = '76.13.232.162';
const USER = 'root';
const PASS = process.env.VPS_ROOT_PASSWORD;
const cmd = process.argv.slice(2).join(' ');

if (!PASS) {
  console.error('ERRO: defina VPS_ROOT_PASSWORD antes de rodar.');
  console.error('Exemplo (PowerShell): $env:VPS_ROOT_PASSWORD="<senha>"');
  process.exit(1);
}
if (!cmd) {
  console.error('ERRO: passe o comando como argumento.');
  console.error('Exemplo: node vps_exec.cjs "pm2 logs --lines 50 --nostream"');
  process.exit(1);
}

const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Exec error:', err.message);
      conn.end();
      process.exit(1);
    }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', (code) => {
      conn.end();
      process.exit(code || 0);
    });
  });
}).on('error', (err) => {
  console.error('SSH error:', err.message);
  process.exit(1);
}).connect({ host: HOST, port: 22, username: USER, password: PASS });
