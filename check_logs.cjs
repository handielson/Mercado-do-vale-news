const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado sucesso!');
  
  // Checking PM2 logs
  conn.exec(`pm2 logs --lines 50 --nostream`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d.toString()).on('close', () => {
        console.log("LOGS:\\n", out);
        conn.end();
    });
  });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
