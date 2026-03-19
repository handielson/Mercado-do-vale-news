const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado sucesso!');
  
  conn.exec(`ls -la /var/www/mdv-api/routes/ && cat /var/www/mdv-api/index.js`, (e, s) => {
       let out2 = '';
       s.on('data', d => out2 += d).on('close', () => {
           console.log("INDEX JS:\\n", out2);
           
           conn.exec(`grep -rnw '/var/www/mdv-api/' -e 'exclude_from_seo' || echo "not found"`, (e2, s2) => {
               let out3 = '';
               s2.on('data', d => out3 += d).on('close', () => {
                   console.log("GREP exclude_from_seo:\\n", out3);
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
