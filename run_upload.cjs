const { Client } = require('ssh2');
const fs = require('fs');

const localFile = 'vps_server.js';
const remoteFile = '/var/www/mdv-api/vps_server.js';

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.fastPut(localFile, remoteFile, (err2) => {
      if (err2) throw err2;
      console.log('File uploaded successfully');
      conn.exec('pm2 restart all', (err3, stream) => {
        if (err3) throw err3;
        stream.on('close', () => conn.end());
      });
    });
  });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
