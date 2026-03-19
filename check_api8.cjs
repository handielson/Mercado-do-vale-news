const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado!');
  
  conn.exec(`grep -n -C 15 "/products/:id" /var/www/mdv-api/server.js`, (e, s) => {
       let out2 = '';
       s.on('data', d => out2 += d).on('close', () => {
           console.log("SERVER.JS MATCH:\\n", out2);
           conn.end();
       });
   });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
