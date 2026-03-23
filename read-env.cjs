const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('cat /var/www/mdv-api/.env', (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => {
      console.log(out);
      conn.end();
    }).on('data', data => out += data).stderr.on('data', data => console.error(String(data)));
  });
}).connect({host: '76.13.232.162', port: 22, username: 'root', password: '@@@@Jsj2865@@@@'});
