const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado sucesso!');
  
  conn.exec(`pm2 info mdv-api | grep "script path"`, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d).on('close', () => {
        const pathMatch = out.match(/script path.+?(\\/.*)/);
        if (pathMatch) {
            const rawPath = pathMatch[1].trim();
            const dir = rawPath.substring(0, rawPath.lastIndexOf('/'));
            console.log("DIR API:", dir);
            conn.exec(`grep -ri -C 10 "app.put('/products/:id'" ${dir}/`, (e, s) => {
               let out2 = '';
               s.on('data', d => out2 += d).on('close', () => {
                   console.log("GREP RES:\\n", out2);
                   
                   // Also let's check the actual error being thrown recently by PM2
                   conn.exec(`cat /root/.pm2/logs/mdv-api-error.log | tail -n 100 | grep -C 5 "updateProduct" || cat /root/.pm2/logs/mdv-api-error.log | tail -n 50`, (e2, s2) => {
                       let outError = '';
                       s2.on('data', d=>outError+=d).on('close', () => {
                           console.log("API ERRORS:\\n", outError);
                           conn.end();
                       })
                   });
               });
            });
        } else {
            console.log("No match:", out);
            conn.end();
        }
    });
  });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
