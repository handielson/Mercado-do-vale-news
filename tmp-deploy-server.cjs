const { Client } = require('ssh2');
const fs = require('fs');

const localContent = fs.readFileSync('server.js', 'utf8');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH conectado! Atualizando /var/www/mdv-api/server.js...');
    conn.exec('cat > /var/www/mdv-api/server.js && cd /var/www/mdv-api && pm2 restart mdv-api', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Deploy concluído.');
            conn.end();
            process.exit(0);
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
        
        // Pipe the content!
        stream.write(localContent);
        stream.end();
    });
}).connect({
    host: '76.13.232.162',
    port: 22,
    username: 'root',
    password: '@@@@Jsj2865@@@@'
});
