/**
 * check_vps_logs.cjs
 * Conecta na VPS via SSH e retorna os logs de erro do PM2 (mdv-api).
 */
const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('Conectado. Buscando logs PM2...\n');
  // Pega as últimas 80 linhas do log de erro do PM2
  conn.exec('pm2 logs mdv-api --lines 80 --nostream 2>&1', (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }

    let out = '';
    stream.on('data', d => { out += d.toString(); });
    stream.stderr.on('data', d => { out += d.toString(); });
    stream.on('close', () => {
      console.log('=== PM2 LOGS ===');
      console.log(out);
      conn.end();
    });
  });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@',
});
