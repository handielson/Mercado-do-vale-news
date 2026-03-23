const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.fastPut('vps_server.js', '/var/www/mdv-api/server.js', (err) => {
      if (err) throw err;
      console.log('vps_server.js uploaded successfully');
      
      conn.exec('pm2 restart mdv-api && pm2 logs mdv-api --lines 15 --nostream', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
          conn.end();
        }).on('data', (data) => {
          console.log(data.toString());
        }).stderr.on('data', (data) => {
          console.error('STDERR: ' + data.toString());
        });
      });
    });
  });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
