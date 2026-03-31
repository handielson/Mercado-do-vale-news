// Executa diagnóstico na VPS via SSH
const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('✅ Conectado à VPS\n');

  // Testamos: 1) últimas linhas do log do PM2, 2) check-video na VPS
  const cmd = `
    echo "=== PM2 logs (últimas 20 linhas) ===" &&
    pm2 logs mdv-api --lines 20 --nostream 2>&1 | tail -30 &&
    echo "" &&
    echo "=== Teste check-video para SKU INEXISTENTE ===" &&
    curl -s "https://api.xiaomipetrolina.com.br/public/check-video?sku=INEXISTENTE_XYZ_123" &&
    echo "" &&
    echo "=== Teste check-video para SKU MSL-A ===" &&
    curl -s "https://api.xiaomipetrolina.com.br/public/check-video?sku=MSL-A" &&
    echo ""
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
