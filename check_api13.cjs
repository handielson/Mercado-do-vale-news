const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado!');
  conn.exec(`mysql -u mercado_do_vale -pmercado123 -e "SELECT COUNT(*) FROM mercadodovale.products;"`, (e, s) => {
       let outError = '';
       s.on('data', d=>outError+=d).on('close', () => {
           console.log("TOTAL PRODUCTS:\\n", outError);
           conn.exec(`mysql -u mercado_do_vale -pmercado123 -e "SELECT id, name FROM mercadodovale.products LIMIT 5;"`, (e2, s2) => {
               let o2='';
               s2.on('data', d=>o2+=d).on('close',()=> {
                 console.log("5 PRODUCTS:\\n", o2);
                 conn.end();
               });
           })
       })
   });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
