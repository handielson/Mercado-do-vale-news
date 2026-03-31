const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

const VpsHost = '76.13.232.162';
const VpsUser = 'root';
const VpsPass = '@@@@Jsj2865@@@@';

console.log('🔗 Conectando ao servidor VPS (' + VpsHost + ')...');

conn.on('ready', () => {
  console.log('✅ Conectado via SSH!');

  conn.exec('pm2 jlist', (err, stream) => {
    if (err) throw err;
    let data = '';
    stream.on('data', (d) => { data += d.toString(); });
    stream.on('close', () => {
      try {
        const pm2List = JSON.parse(data);
        const apiProc = pm2List.find(p => p.pm2_env.pm_exec_path.includes('server') || p.name.includes('api') || p.name.includes('vps'));
        
        if (!apiProc) {
           console.log('❌ Processo PM2 da API não encontrado.');
           return conn.end();
        }

        const appDir = apiProc.pm2_env.pm_cwd;
        console.log(`🚀 App encontrada no diretório: ${appDir}`);

        conn.sftp((err, sftp) => {
          if (err) throw err;
          
          const localFilePath = path.join(__dirname, 'vps-add-virtual.cjs');
          const remoteFilePath = appDir + '/vps-add-virtual.cjs';

          console.log(`📤 Enviando script de migração para a VPS...`);
          
          sftp.fastPut(localFilePath, remoteFilePath, (err) => {
            if (err) {
               console.log('❌ Erro no upload:', err);
               sftp.end();
               return conn.end();
            }
            console.log('✅ Script enviado! Rodando na VPS...');
            
            // Executa o script dentro do diretório que contém o .env da VPS
            conn.exec(`cd ${appDir} && node vps-add-virtual.cjs`, (err, rStream) => {
              if (err) throw err;
              rStream.on('close', () => {
                console.log(`🏁 Execução concluída.`);
                sftp.end();
                conn.end();
              }).on('data', (d) => {
                console.log(d.toString().trim());
              }).stderr.on('data', (data) => {
                console.error(data.toString().trim());
              });
            });
          });
        });
      } catch(e) {
         console.log('Erro:', e);
         conn.end();
      }
    });
  });
}).connect({
  host: VpsHost,
  port: 22,
  username: VpsUser,
  password: VpsPass
});
