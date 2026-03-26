const { Client } = require('ssh2');

const sql = `
ALTER TABLE company_settings ADD COLUMN shopee_partner_id VARCHAR(255);
ALTER TABLE company_settings ADD COLUMN shopee_partner_key TEXT;
ALTER TABLE company_settings ADD COLUMN shopee_shop_id VARCHAR(50);
ALTER TABLE company_settings ADD COLUMN shopee_access_token TEXT;
ALTER TABLE company_settings ADD COLUMN shopee_refresh_token TEXT;
ALTER TABLE products ADD COLUMN shopee_item_id BIGINT;
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  // First get DB_NAME from /var/www/mdv-api/.env
  conn.exec(`cat /var/www/mdv-api/.env | grep DB_NAME`, (err, stream) => {
    if (err) throw err;
    let dbName = 'xiaomipetrolina'; // default guess
    stream.on('close', (code, signal) => {
      console.log('DB Name Found:', dbName);
      
      const runSql = `mysql ${dbName} -e "${sql.replace(/\n/g, ' ')}"`;
      conn.exec(runSql, (err2, stream2) => {
        if (err2) throw err2;
        stream2.on('close', () => {
          console.log('Migration finished');
          conn.end();
        }).on('data', d => console.log('STDOUT: ' + d))
          .stderr.on('data', d => console.log('STDERR: ' + d));
      });

    }).on('data', (data) => {
      const match = data.toString().match(/DB_NAME=([^\s]+)/);
      if (match) dbName = match[1];
    });
  });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
