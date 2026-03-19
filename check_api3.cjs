const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado sucesso!');
  
  conn.exec(`pm2 info mdv-api | grep "script path"`, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d).on('close', () => {
        const p = out.indexOf('/');
        if (p > -1) {
            const rawPath = out.substring(p).trim();
            const dir = rawPath.substring(0, rawPath.lastIndexOf('/'));
            console.log("DIR API:", dir);
            conn.exec(`grep -ri -C 10 "app.put('/products/:id'" ${dir}/`, (e, s) => {
               let out2 = '';
               s.on('data', d => out2 += d).on('close', () => {
                   console.log("GREP RES:\\n", out2);
                   
                   conn.exec(`tail -n 100 /root/.pm2/logs/mdv-api-error.log | grep -C 5 "updateProduct" || tail -n 50 /root/.pm2/logs/mdv-api-error.log`, (e2, s2) => {
                       let outError = '';
                       s2.on('data', d=>outError+=d).on('close', () => {
                           console.log("API ERRORS:\\n", outError);
                           conn.end();
                       })
                   });
               });
            });
        }
    });
  });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
