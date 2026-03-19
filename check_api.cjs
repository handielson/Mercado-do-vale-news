const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado sucesso!');
  
  // Checking products.js or index.js
  conn.exec(`cat /var/www/mdv-api/server.js || cat /var/www/mdv-api/index.js`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d.toString()).on('close', () => {
        conn.exec(`grep -ri -C 5 "app.put('/products/:id'" /var/www/mdv-api/`, (err2, stream2) => {
            let out2 = '';
            stream2.on('data', d => out2 += d).on('close', () => {
                console.log("GREP RES:\\n", out2);
                conn.end();
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
