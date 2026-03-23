const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const sql = "mysql -u mercadodovale -p@@@@Jsj2865@@@@ mercadodovale -e \"DELETE FROM catalog_banners WHERE image_url LIKE '%placeholder%';\"";
  conn.exec(sql, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Done!');
      conn.end();
    }).on('data', (data) => console.log('OUT: ' + data)).stderr.on('data', (data) => console.error('ERR: ' + data));
  });
}).connect({host: '76.13.232.162', port: 22, username: 'root', password: '@@@@Jsj2865@@@@'});
