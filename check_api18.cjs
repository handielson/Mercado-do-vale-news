const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado!');
  conn.exec(`grep -C 10 -n "fastify.put('/products/:id'" /var/www/mdv-api/server.js`, (e, s) => {
       let outError = '';
       s.on('data', d=>outError+=d).on('close', () => {
           console.log("SERVER JS PUT:\\n", outError);
           conn.exec(`grep -C 10 -n "UPDATE products SET" /var/www/mdv-api/server.js`, (e2, s2) => {
               let outError2 = '';
               s2.on('data', d=>outError2+=d).on('close', () => {
                   console.log("SERVER JS UPDATE:\\n", outError2);
                   conn.end();
               })
           })
       })
   });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
