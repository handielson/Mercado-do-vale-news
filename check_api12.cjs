const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado!');
  conn.exec(`mysql -u mercado_do_vale -pmercado123 -e "SELECT id, name, exclude_from_seo FROM mercadodovale.products WHERE name LIKE '%Cinebox%';"`, (e, s) => {
       let outError = '';
       s.on('data', d=>outError+=d).on('close', () => {
           console.log("DB DATA:\\n", outError);
           conn.exec('tail -n 100 /root/.pm2/logs/mdv-api-error.log', (e2, s2) => {
              s2.pipe(process.stdout);
              s2.on('close', () => conn.end());
           });
       })
   });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
