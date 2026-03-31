const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('✅ Conectado à VPS\n');

  // Verifica qual arquivo o PM2 está realmente usando e mostra as linhas do check-video
  conn.exec(
    `pm2 jlist | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const list=JSON.parse(d); const p=list[0]; console.log('Script:', p.pm2_env.pm_exec_path); console.log('CWD:', p.pm2_env.pm_cwd);" && grep -n 'check-video\\|exists: true\\|videoExistenceCache\\|synoLogin' /var/www/mdv-api/server.js | head -30`,
    (err, stream) => {
      if (err) { console.error(err); conn.end(); return; }
      stream.on('data', d => process.stdout.write(d.toString()));
      stream.stderr.on('data', d => process.stderr.write(d.toString()));
      stream.on('close', () => conn.end());
    }
  );
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
