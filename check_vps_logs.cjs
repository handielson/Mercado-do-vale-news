const { Client } = require('C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH conectado!');
  conn.exec('export $(cat /var/www/mdv-api/.env | grep -v "^#" | xargs) && mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME -e "SELECT received_at, payload FROM webhook_logs WHERE payload LIKE \'%order%\' ORDER BY received_at DESC LIMIT 5"', (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d.toString()).on('close', () => {
      console.log('ORDER WEBHOOKS:');
      console.log(out);
      conn.end();
    });
  });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
