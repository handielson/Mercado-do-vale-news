const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado!');
  
  conn.exec(`cat /var/www/mdv-api/.env | grep DB_NAME`, (e, s) => {
       let out2 = '';
       s.on('data', d => out2 += d).on('close', () => {
           console.log("DB_NAME Configured in API:\\n", out2);
           conn.exec(`mysql -u mercado_do_vale -pmercado123 -e "SHOW DATABASES;"`, (e2, s2) => {
               let outError = '';
               s2.on('data', d=>outError+=d).on('close', () => {
                   console.log("DATABASES:\\n", outError);
                   conn.end();
               })
           });
       });
   });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
