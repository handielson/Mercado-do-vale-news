const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.fastGet('/var/www/mdv-api/server.js', 'vps_server.js', (err) => {
      if (err) throw err;
      console.log('vps_server.js downloaded successfully');
      conn.end();
    });
  });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
