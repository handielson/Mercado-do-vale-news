const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const localFile = 'server.js';
    const remoteFile = '/var/www/mdv-api/server.js';
    
    console.log('Uploading server.js...');
    sftp.fastPut(localFile, remoteFile, (err) => {
      if (err) throw err;
      console.log('Upload complete!');
      
      conn.exec('pm2 restart mdv-api', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
          console.log('pm2 restart completed.');
          conn.end();
        }).on('data', (data) => {
          console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
          console.error('STDERR: ' + data);
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
