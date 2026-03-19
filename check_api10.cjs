const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado sucesso!');
  
  conn.exec(`grep -i "cors" /var/www/mdv-api/server.js`, (e, s) => {
       let out2 = '';
       s.on('data', d => out2 += d).on('close', () => {
           console.log("CORS:\\n", out2);
           conn.exec(`mysql -u mercado_do_vale -pmercado123 -e "SELECT id, name, exclude_from_seo FROM mercado_do_vale.products LIMIT 5;"`, (e2, s2) => {
               let out3 = '';
               s2.on('data', d => out3 += d).on('close', () => {
                   console.log("DB STATE:\\n", out3);
                   conn.end();
               })
           })
       });
   });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
