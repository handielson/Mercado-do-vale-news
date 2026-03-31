const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const sshConfig = {
  host: process.env.VITE_VPS_HOST || '76.13.232.162',
  port: parseInt(process.env.VITE_VPS_PORT || '22'),
  username: process.env.VITE_VPS_USER || 'root',
  password: process.env.VITE_VPS_PASSWORD || '@@@@Jsj2865@@@@',
  readyTimeout: 10000,
};

const REMOTE_DIR = '/var/www/mdv-api';
const LOCAL_SCRIPT = path.join(__dirname, 'convert-base64.js');
const REMOTE_SCRIPT = `${REMOTE_DIR}/convert-base64.js`;

console.log(`🔗 Conectando ao servidor VPS (${sshConfig.host})...`);
const conn = new Client();

conn.on('ready', () => {
  console.log('✅ Conectado via SSH!');

  conn.sftp((err, sftp) => {
    if (err) {
      console.error('❌ Erro no SFTP:', err);
      conn.end();
      return;
    }

    console.log(`📤 Enviando convert-base64.js para ${REMOTE_SCRIPT}...`);
    sftp.fastPut(LOCAL_SCRIPT, REMOTE_SCRIPT, (err) => {
      if (err) {
        console.error('❌ Falha ao enviar script:', err);
        conn.end();
        return;
      }
      console.log('✅ convert-base64.js enviado com sucesso!');

      console.log('🚀 Executando o conversor de imagens na VPS...');
      conn.exec(`node ${REMOTE_SCRIPT}`, (err, stream) => {
        if (err) {
          console.error('❌ Erro ao executar comando:', err);
          conn.end();
          return;
        }

        stream.on('close', (code, signal) => {
          console.log(`\n✅ Conversão concluída na VPS (Código: ${code}).`);
          conn.end();
        }).on('data', (data) => {
          process.stdout.write(data.toString());
        }).stderr.on('data', (data) => {
          process.stderr.write(data.toString());
        });
      });
    });
  });
}).on('error', (err) => {
  console.error('❌ Erro de conexão SSH:', err.message);
}).connect(sshConfig);
