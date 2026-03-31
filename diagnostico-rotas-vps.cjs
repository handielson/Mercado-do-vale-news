const { Client } = require('ssh2');

const remoteScript = `
  const fs = require('fs');

  console.log('\\n=== Analyzing /var/www/mdv-api/server.js ===');
  const lines = fs.readFileSync('/var/www/mdv-api/server.js', 'utf8').split('\\n');
  lines.forEach((line, i) => {
    if (line.includes('fastify.delete') || line.includes('fastify.put') || line.includes('fastify.post') || line.includes('fastify.get') || line.includes('fastify.patch')) {
      if (line.includes('/products/:id') || line.includes('/combos')) {
        console.log(\`\${i+1}: \${line.trim()}\`);
      }
    }
  });
`;

console.log('⏳ Conectando à VPS para verificar server.js remoto...');

const conn = new Client();
conn.on('ready', () => {
  console.log('✅ Conectado!');
  const base64Script = Buffer.from(remoteScript).toString('base64');
  conn.exec(`node -e "eval(Buffer.from('${base64Script}', 'base64').toString('utf8'))"`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => {
      console.log(out);
      conn.end();
    }).on('data', data => out += data).stderr.on('data', data => console.error(data.toString()));
  });

}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
