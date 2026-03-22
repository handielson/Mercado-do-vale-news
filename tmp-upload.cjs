const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH conectado!');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const readStream = fs.createReadStream('./server.js');
        const writeStream = sftp.createWriteStream('/var/www/mdv-api/server.js');
        readStream.pipe(writeStream);
        writeStream.on('close', () => {
            console.log('Arquivo server.js enviado com sucesso!');
            conn.exec('pm2 restart mdv-api', (e, stream) => {
                stream.on('close', () => {
                   console.log('PM2 reiniciado!');
                   conn.end();
                }).on('data', d => console.log('STDOUT: ' + d)).stderr.on('data', d => console.log('STDERR: ' + d));
            });
        });
        writeStream.on('error', (e) => {
            console.error('SFTP upload error:', e);
            conn.end();
        });
    });
}).connect({
    host: '76.13.232.162',
    port: 22,
    username: 'root',
    password: '@@@@Jsj2865@@@@'
});
