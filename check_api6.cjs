const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado sucesso!');
  
  conn.exec(`ls -la /var/www/mdv-api/`, (e, s) => {
       let out2 = '';
       s.on('data', d => out2 += d).on('close', () => {
           console.log("DIR:\\n", out2);
           
           conn.exec(`find /var/www/mdv-api/ -name "*.js" | xargs grep -il "put"`, (e2, s2) => {
               let out3 = '';
               s2.on('data', d => out3 += d).on('close', () => {
                   console.log("FILES WITH PUT:\\n", out3);
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
