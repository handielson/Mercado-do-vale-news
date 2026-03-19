const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado!');
  conn.exec(`mysql -u mdv_api -pMdv2026Secure -e "SELECT id, name, exclude_from_seo FROM mercadodovale.products WHERE name LIKE '%cine%';"`, (e, s) => {
       let curr = '';
       s.on('data', d=>curr+=d).on('close', () => {
           console.log("DB DATA:\\n", curr);
           conn.exec('tail -n 100 /root/.pm2/logs/mdv-api-error.log', (e2, s2) => {
              let ecode = '';
              s2.on('data', d=>ecode+=d).on('close', () => {
                  console.log("API ERRORS:\\n", ecode);
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
