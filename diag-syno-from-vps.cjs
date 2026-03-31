// Testa conexão com Synology diretamente da VPS via SSH
const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('✅ Conectado à VPS\n');

  const nodeScript = `
    require('dotenv').config();
    const https = require('https');
    const SYNO_URL = process.env.SYNOLOGY_URL;
    const SYNO_USER = process.env.SYNOLOGY_USER;
    const SYNO_PASS = process.env.SYNOLOGY_PASS;
    console.log('URL:', SYNO_URL);
    console.log('USER:', SYNO_USER ? 'SET' : 'NOT SET');
    console.log('PASS:', SYNO_PASS ? 'SET' : 'NOT SET');
    if (!SYNO_USER || !SYNO_PASS) { console.log('Sem credenciais!'); process.exit(0); }
    const urlObj = new URL(SYNO_URL);
    const qs = 'api=SYNO.API.Auth&version=7&method=login&account=' + encodeURIComponent(SYNO_USER) + '&passwd=' + encodeURIComponent(SYNO_PASS) + '&session=FileStation&format=sid';
    const req = https.get({ hostname: urlObj.hostname, port: parseInt(urlObj.port) || 5001, path: '/webapi/auth.cgi?' + qs, rejectUnauthorized: false }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j.success) {
            console.log('LOGIN OK, SID:', j.data.sid.slice(0,8));
            const sid = j.data.sid;
            const lp = '/webapi/entry.cgi?api=SYNO.FileStation.List&version=2&method=list&folder_path=%2Fweb%2Fvideos&limit=1000&_sid=' + sid;
            https.get({ hostname: urlObj.hostname, port: parseInt(urlObj.port)||5001, path: lp, rejectUnauthorized: false }, res2 => {
              let d2 = '';
              res2.on('data', c => d2 += c);
              res2.on('end', () => {
                try {
                  const j2 = JSON.parse(d2);
                  console.log('LIST success:', j2.success);
                  if (j2.success) {
                    const files = j2.data.files || [];
                    console.log('Total:', files.length);
                    console.log('Arquivos:', files.map(f => f.name).join(', '));
                  } else { console.log('Erro list:', JSON.stringify(j2.error)); }
                } catch(e) { console.log('Parse list error:', d2.slice(0,300)); }
              });
            }).on('error', e => console.log('LIST error:', e.message))
              .setTimeout(15000, function(){ this.destroy(); console.log('LIST timeout'); });
          } else { console.log('LOGIN FAILED:', JSON.stringify(j.error)); }
        } catch(e) { console.log('Parse login error:', d.slice(0,200)); }
      });
    });
    req.on('error', e => console.log('CONNECTION error:', e.message));
    req.setTimeout(15000, () => { req.destroy(); console.log('CONNECTION timeout'); });
  `.replace(/\n\s*/g, ' ');

  const cmd = `cd /var/www/mdv-api && node -e "${nodeScript.replace(/"/g, '\\"')}" 2>&1`;

  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
