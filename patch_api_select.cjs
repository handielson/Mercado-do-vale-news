const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado!');
  conn.exec(`sed -i 's/created_at, updated_at/exclude_from_seo, created_at, updated_at/g' /var/www/mdv-api/server.js`, (e, s) => {
       s.on('data', d=>console.log(d.toString())).on('close', () => {
           conn.exec(`pm2 restart mdv-api`, (e2, s2) => {
              s2.pipe(process.stdout);
              s2.on('close', () => {
                  console.log("PATCH API COMPLETADO!");
                  conn.end();
              });
           });
       })
   });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
