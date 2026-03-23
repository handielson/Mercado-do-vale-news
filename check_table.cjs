const { Client } = require('ssh2'); 
const conn = new Client(); 
conn.on('ready', () => { 
  conn.exec('mysql -u mdv_api -pMdv2026Secure mercadodovale -e "DESCRIBE company_settings;"', (err, stream) => { 
    stream.on('data', (d) => process.stdout.write(d.toString()))
          .on('close', () => conn.end()); 
  }); 
}).connect({
  host: '76.13.232.162', 
  port: 22, 
  username: 'root', 
  password: '@@@@Jsj2865@@@@'
});
