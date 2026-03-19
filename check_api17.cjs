const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado!');
  conn.exec(`grep -C 10 -n "SELECT .*FROM products" /var/www/mdv-api/server.js`, (e, s) => {
       let outError = '';
       s.on('data', d=>outError+=d).on('close', () => {
           console.log("SERVER JS:\\n", outError);
           conn.end();
       })
   });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
