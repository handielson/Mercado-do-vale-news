const { Client } = require('ssh2');

// IMPORTANTE: Substitua pela sua chave real do painel Shopee Open Platform (Sandbox)
const PARTNER_ID = '1229870';
const PARTNER_KEY = 'shpk45434a69786d53566659686c634d6254796f556956517347454c47754e45';

const SYNC_SECRET = '4eae1b3fe1ab3224bb53fd2402d46cf57b86ef98dd53775eb5a5f178f1d5b3f4';
const DB = 'mercadodovale';

const sql = `UPDATE company_settings SET shopee_partner_id='${PARTNER_ID}', shopee_partner_key='${PARTNER_KEY}' LIMIT 1;`;

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected to VPS');
  conn.exec(`mysql -u mdv_api -pMdv2026Secure ${DB} -e "${sql}"`, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      console.log('Done. Exit code:', code);
      conn.end();
    }).on('data', d => console.log('STDOUT: ' + d))
      .stderr.on('data', d => console.log('STDERR: ' + d));
  });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
