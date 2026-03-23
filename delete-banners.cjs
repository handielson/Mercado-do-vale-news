const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const sql = "mysql -u mdv_api -pMdv2026Secure mercadodovale -e \"DELETE FROM banners WHERE image_url LIKE '%placeholder%';\"";
  conn.exec(sql, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => {
      console.log('Banners temporarios deletados!');
      conn.end();
    }).on('data', data => out += data).stderr.on('data', data => console.error(String(data)));
  });
}).connect({host: '76.13.232.162', port: 22, username: 'root', password: '@@@@Jsj2865@@@@'});
