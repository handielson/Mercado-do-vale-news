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

  // Executa pm2 jlist para encontrar o diretório do projeto onde api.xiaomipetrolina.com.br está rodando
  conn.exec('pm2 jlist', (err, stream) => {
    if (err) throw err;
    let data = '';
    stream.on('data', (d) => { data += d.toString(); });
    stream.on('close', () => {
      try {
        const pm2List = JSON.parse(data);
        if (pm2List.length === 0) {
           console.log('Nenhum processo PM2 rodando?! Tentando procurar pmdrops ou arquivos js na unha...');
           return finishAndClose();
        }
        
        // Pega o processo que provávelmente é a API
        const apiProc = pm2List.find(p => p.pm2_env.pm_exec_path.includes('server') || p.name.includes('api') || p.name.includes('vps'));
        
        if (!apiProc) {
           console.log('Processos PM2:', pm2List.map(p => ({name: p.name, path: p.pm2_env.pm_cwd})));
           return finishAndClose();
        }

        const appDir = apiProc.pm2_env.pm_cwd;
        const mainScript = apiProc.pm2_env.pm_exec_path;
        console.log(`🚀 App PM2 encontrada! Diretório base: ${appDir} (Script: ${path.basename(mainScript)})`);

        // Fazer upload do vps_server.js via SFTP
        conn.sftp((err, sftp) => {
          if (err) throw err;
          
          const localFilePath = path.join(__dirname, 'vps_server.js');
          const remoteFilePath = appDir + '/vps_server.js';
          const localServerPath = path.join(__dirname, 'server.js');
          const remoteServerPath = appDir + '/server.js';

          console.log(`📤 Enviando vps_server.js para ${remoteFilePath}...`);
          
          sftp.fastPut(localFilePath, remoteFilePath, (err) => {
            if (err) {
               console.log('❌ Erro no upload do vps_server.js:', err);
               sftp.end();
               return finishAndClose();
            }
            console.log('✅ vps_server.js enviado com sucesso!');
            
            console.log(`📤 Enviando server.js para ${remoteServerPath}...`);
            sftp.fastPut(localServerPath, remoteServerPath, (err) => {
              if (err) {
                 console.log('⚠️ Erro ao enviar server.js (se nao usa, td bem):', err);
              } else {
                 console.log('✅ server.js enviado com sucesso!');
              }
              
              const restartCmd = `pm2 restart ${apiProc.name}`;
              console.log(`🔄 Reiniciando a aplicação: ${restartCmd}`);
              conn.exec(restartCmd, (err, rStream) => {
                if (err) throw err;
                rStream.on('close', () => {
                  console.log(`✅ App ${apiProc.name} reiniciada! A nova rota já deve estar ativa na VPS.`);
                  sftp.end();
                  conn.end();
                }).on('data', (d) => {
                  console.log(d.toString().trim());
                });
              });
            });
          });
        });
      } catch(e) {
         console.log('Erro ao ler PM2:', data, e);
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

function finishAndClose() {
  conn.end();
}
