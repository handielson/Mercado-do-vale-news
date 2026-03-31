const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  conn.exec('pm2 logs mdv-api --lines 50 --nostream', (err, stream) => {
    if (err) throw err;
    stream.on('data', (d) => { console.log(d.toString()); });
    stream.on('close', () => {
      conn.end();
    });
  });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
